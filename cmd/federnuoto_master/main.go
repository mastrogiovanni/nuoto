package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"nuoto/internal/federnuoto"
	"nuoto/internal/strutil"
	"nuoto/internal/worker"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const workers = 1
const garaWorkers = 5

type atletaInfo struct {
	Nome    string `json:"nome"`
	Anno    string `json:"anno"`
	Societa string `json:"societa"`
	Nazione string `json:"nazione"`
}

type tempo struct {
	Stile          string   `json:"stile"`
	SiglaCategoria string   `json:"sigla_categoria"`
	Sesso          string   `json:"sesso"`
	Posizione      string   `json:"posizione"`
	Tempo          string   `json:"tempo"`
	Passaggi       []string `json:"passaggi,omitempty"`
}

type atletaResult struct {
	Atleta atletaInfo `json:"atleta"`
	Tempi  []tempo    `json:"tempi"`
}

type eventJob struct {
	year          string
	outputDir     string
	event         federnuoto.Event
	enableParsing bool
	skipAgeCheck  bool // bypass 14-day PDF recency guard (set when --event-id is used)
	openaiClient  *federnuoto.OpenAIClient
}

func normalizeEventDir(event federnuoto.Event) string {
	return strutil.Normalize(event.ID + " " + event.Name)
}

func writeJSON(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func isEventComplete(dir string) bool {
	info, err := os.Stat(filepath.Join(dir, ".terminated"))
	return err == nil && !info.IsDir()
}

func hasAthleteFiles(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".json" && e.Name() != "info.json" {
			return true
		}
	}
	return false
}

func clearStaleTerminated(outputDir string) {
	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		dir := filepath.Join(outputDir, e.Name())
		terminatedPath := filepath.Join(dir, ".terminated")
		if _, err := os.Stat(terminatedPath); err != nil {
			continue
		}
		if !hasAthleteFiles(dir) {
			log.Printf("[stale] removing .terminated from %s (no athlete files)", dir)
			_ = os.Remove(terminatedPath)
		}
	}
}

func processEvent(job eventJob) []string {
	event := job.event
	eventDir := filepath.Join(job.outputDir, normalizeEventDir(event))

	cache := federnuoto.NewCache(filepath.Join(job.outputDir, ".partial"))

	// When the event is already fully scraped, only re-run PDF parsing if requested.
	if isEventComplete(eventDir) {
		if !job.enableParsing {
			log.Printf("[skip] %s: %s", event.ID, event.Name)
			return nil
		}
		log.Printf("[skip-api] %s: already complete, running PDF parsing only", event.ID)
		if _, err := federnuoto.GetMasterGaraFromEvento(job.year, event.ID, cache); err != nil {
			log.Printf("[error] fetch gare for event %s: %v", event.ID, err)
			return nil
		}
		tryParsePDF(job, eventDir, cache)
		return nil
	}

	log.Printf("[event] %s: %s -> %s", event.ID, event.Name, eventDir)

	infoPath := filepath.Join(eventDir, "info.json")
	if err := writeJSON(infoPath, event); err != nil {
		log.Printf("[error] write info.json for event %s: %v", event.ID, err)
		return nil
	}

	gare, err := federnuoto.GetMasterGaraFromEvento(job.year, event.ID, cache)
	if err != nil {
		log.Printf("[error] fetch gare for event %s: %v", event.ID, err)
		return nil
	}
	log.Printf("[event] %s: %d gare", event.Name, len(gare))

	// PDF parsing runs here, after the API response is in cache, regardless of gare count.
	if job.enableParsing {
		tryParsePDF(job, eventDir, cache)
	}

	if len(gare) == 0 {
		log.Printf("[skip] %s: no gare found, competition not yet started", event.Name)
		return nil
	}

	atletiMap := make(map[string]*atletaResult)
	var mu sync.Mutex
	var garaErrors []string
	sem := worker.NewSemaphore(garaWorkers)
	var wg sync.WaitGroup

	for _, gara := range gare {
		wg.Add(1)
		sem.Acquire()
		go func(g federnuoto.Collegamento) {
			defer wg.Done()
			defer sem.Release()

			athletes, err := federnuoto.GetMasterResults(job.year, g.IDEvento, g.CodiceGara, g.IDCategoria, g.Sesso, cache)
			if err != nil {
				msg := fmt.Sprintf("event %s (%s), gara %s/%s/%s: %v", event.ID, event.Name, g.IDEvento, g.CodiceGara, g.IDCategoria, err)
				log.Printf("[error] %s", msg)
				mu.Lock()
				garaErrors = append(garaErrors, msg)
				mu.Unlock()
				return
			}
			log.Printf("Results for gara %s/%s/%s: %d", g.IDEvento, g.CodiceGara, g.IDCategoria, len(athletes))

			mu.Lock()
			for _, a := range athletes {
				key := strings.ToUpper(a.Nome) + "|" + a.Anno + "|" + a.Societa

				if _, ok := atletiMap[key]; !ok {
					atletiMap[key] = &atletaResult{
						Atleta: atletaInfo{
							Nome:    a.Nome,
							Anno:    a.Anno,
							Societa: a.Societa,
							Nazione: a.Nazione,
						},
					}
				}
				atletiMap[key].Tempi = append(atletiMap[key].Tempi, tempo{
					Stile:          g.Stile,
					SiglaCategoria: g.IDCategoria,
					Sesso:          g.Sesso,
					Posizione:      a.Posizione,
					Tempo:          a.Tempo,
					Passaggi:       a.Passaggi,
				})
			}
			mu.Unlock()
		}(gara)
	}
	wg.Wait()

	log.Printf("[event] %s: %d athletes found", event.Name, len(atletiMap))

	for _, atleta := range atletiMap {
		filename := strutil.Normalize(atleta.Atleta.Nome) + ".json"
		path := filepath.Join(eventDir, filename)
		if err := writeJSON(path, atleta); err != nil {
			log.Printf("[error] write %s: %v", path, err)
			continue
		}
		log.Printf("[ok] %s", path)
	}

	terminatedPath := filepath.Join(eventDir, ".terminated")
	if err := os.WriteFile(terminatedPath, nil, 0644); err != nil {
		log.Printf("[error] write .terminated for event %s: %v", event.ID, err)
	}

	return garaErrors
}

func tryParsePDF(job eventJob, eventDir string, cache *federnuoto.Cache) {
	event := job.event
	if !job.skipAgeCheck && !federnuoto.IsEventWithin14Days(event) {
		log.Printf("[pdf-skip] event %s: older than 14 days (use --event-id to force)", event.ID)
		return
	}
	pdfURL := federnuoto.GetMasterEventPDFURL(event.ID, cache)
	if pdfURL == "" {
		log.Printf("[pdf-skip] event %s: no PDF results link found", event.ID)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if _, err := federnuoto.ParseEventPDF(ctx, event.ID, pdfURL, eventDir, job.openaiClient); err != nil {
		log.Printf("[pdf-error] event %s: %v", event.ID, err)
	}
}

func main() {
	enableParsing := flag.Bool("enable-parsing", false, "parse PDF results using OpenAI (only events within last 14 days)")
	eventID := flag.String("event-id", "", "process only the event with this ID (bypasses 14-day PDF age check)")
	flag.Parse()

	args := flag.Args()
	if len(args) != 1 {
		fmt.Fprintf(os.Stderr, "usage: %s [--enable-parsing] [--event-id <id>] <year>\n", os.Args[0])
		os.Exit(1)
	}
	year := args[0]
	if _, err := strconv.Atoi(year); err != nil {
		fmt.Fprintf(os.Stderr, "invalid year %q: %v\n", year, err)
		os.Exit(1)
	}
	outputDir := fmt.Sprintf("data_federnuoto_master/%s", year)

	var openaiClient *federnuoto.OpenAIClient
	if *enableParsing {
		openaiClient = federnuoto.NewOpenAIClient()
		if openaiClient.APIKey == "" {
			log.Fatal("--enable-parsing requires OPENAI_API_KEY to be set")
		}
		log.Printf("PDF parsing enabled (model: %s)", openaiClient.Model)
	}

	log.Println("Initializing master session...")
	if err := federnuoto.InitMasterSession(); err != nil {
		log.Printf("[warn] session init failed (will retry on requests): %v", err)
	}

	clearStaleTerminated(outputDir)
	log.Printf("Fetching master events for year %s...", year)

	jobs := make(chan eventJob, 100)

	go func() {
		page := 1
		seen := make(map[string]bool)
		for {
			events, err := federnuoto.GetMasterEventsForYear(year, page)
			log.Printf("[page %d] found %d master events", page, len(events))
			if err != nil {
				log.Printf("[error] fetch master events page %d: %v", page, err)
				break
			}
			if len(events) == 0 {
				log.Println("No more master events found, stopping.")
				break
			}
			for _, e := range events {
				if *eventID != "" && e.ID != *eventID {
					continue
				}
				if !seen[e.ID] {
					seen[e.ID] = true
					log.Printf("[queue] event %s: %s", e.ID, e.Name)
					jobs <- eventJob{
						year:          year,
						outputDir:     outputDir,
						event:         e,
						enableParsing: *enableParsing,
						skipAgeCheck:  *eventID != "",
						openaiClient:  openaiClient,
					}
				} else {
					log.Printf("[skip] event %s: %s (duplicate)", e.ID, e.Name)
				}
			}
			if *eventID != "" && seen[*eventID] {
				break // found the target event, no need to fetch more pages
			}
			page++
		}
		close(jobs)
	}()

	time.Sleep(5 * time.Second)

	var allErrors []string
	var allErrorsMu sync.Mutex
	worker.RunPool(workers, jobs, func(job eventJob) {
		errs := processEvent(job)
		if len(errs) > 0 {
			allErrorsMu.Lock()
			allErrors = append(allErrors, errs...)
			allErrorsMu.Unlock()
		}
	})

	if len(allErrors) > 0 {
		log.Printf("Competitions with errors (%d):", len(allErrors))
		for _, e := range allErrors {
			log.Printf("  - %s", e)
		}
	}
	log.Println("Done.")
}
