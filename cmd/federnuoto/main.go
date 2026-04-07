package main

import (
	"encoding/json"
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
	Stile       string   `json:"stile"`
	IDCategoria string   `json:"id_categoria"`
	Sesso       string   `json:"sesso"`
	Posizione   string   `json:"posizione"`
	Tempo       string   `json:"tempo"`
	Passaggi    []string `json:"passaggi,omitempty"`
}

type atletaResult struct {
	Atleta atletaInfo `json:"atleta"`
	Tempi  []tempo    `json:"tempi"`
}

type eventJob struct {
	year      string
	outputDir string
	event     federnuoto.Event
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

// hasAthleteFiles returns true if the directory contains at least one JSON file
// that is not info.json (i.e. an athlete result file).
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

// clearStaleTerminated removes .terminated from dirs that have it but no athlete files,
// so they will be re-downloaded on the next run.
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
			continue // no .terminated
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

	if isEventComplete(eventDir) {
		log.Printf("[skip] %s: %s", event.ID, event.Name)
		return nil
	}

	log.Printf("[event] %s: %s -> %s", event.ID, event.Name, eventDir)

	infoPath := filepath.Join(eventDir, "info.json")
	if err := writeJSON(infoPath, event); err != nil {
		log.Printf("[error] write info.json for event %s: %v", event.ID, err)
		return nil
	}

	log.Println(filepath.Join(job.outputDir, ".partial"))

	cache := federnuoto.NewCache(filepath.Join(job.outputDir, ".partial"))

	gare, err := federnuoto.GetGaraFromEvento(job.year, event.ID, cache)
	if err != nil {
		log.Printf("[error] fetch gare for event %s: %v", event.ID, err)
		return nil
	}
	log.Printf("[event] %s: %d gare", event.Name, len(gare))

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

			athletes, err := federnuoto.GetResults(job.year, g.IDEvento, g.CodiceGara, g.IDCategoria, g.Sesso, cache)
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
					Stile:       g.Stile,
					IDCategoria: g.IDCategoria,
					Sesso:       g.Sesso,
					Posizione:   a.Posizione,
					Tempo:       a.Tempo,
					Passaggi:    a.Passaggi,
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

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintf(os.Stderr, "usage: %s <year>\n", os.Args[0])
		os.Exit(1)
	}
	year := os.Args[1]
	if _, err := strconv.Atoi(year); err != nil {
		fmt.Fprintf(os.Stderr, "invalid year %q: %v\n", year, err)
		os.Exit(1)
	}
	outputDir := fmt.Sprintf("data_federnuoto/%s", year)

	clearStaleTerminated(outputDir)
	log.Printf("Fetching events for year %s...", year)

	jobs := make(chan eventJob, 100)

	go func() {
		page := 1
		seen := make(map[string]bool)
		for {
			events, err := federnuoto.GetEventsForYear(year, page)
			log.Printf("[page %d] found %d events", page, len(events))
			if err != nil {
				log.Printf("[error] fetch events page %d: %v", page, err)
				break
			}
			if len(events) == 0 {
				log.Println("No more events found, stopping.")
				break
			}
			for _, e := range events {
				// if e.ID != "142854" {
				// 	log.Printf("[skip] event %s: %s (filtered out)", e.ID, e.Name)
				// 	continue
				// }
				if !seen[e.ID] {
					seen[e.ID] = true
					log.Printf("[queue] event %s: %s", e.ID, e.Name)
					jobs <- eventJob{year: year, outputDir: outputDir, event: e}
				} else {
					log.Printf("[skip] event %s: %s (duplicate)", e.ID, e.Name)
				}
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
