	package main

	import (
		"encoding/json"
		"fmt"
		"io"
		"log"
		"math/rand"
		"net/http"
		"os"
		"path/filepath"
		"regexp"
		"strings"
		"sync"
		"time"
		"unicode"
	)

	const (
		baseURL    = "https://apinuoto.ficr.it/NUO/mpcache-30/get"
		outputDir  = "data/2022"
		maxRetries = 8
		workers    = 5
	)

	var nonAlphanumRe = regexp.MustCompile(`[^a-z0-9]+`)

	// normalizeString transliterates Latin-extended and accented characters to ASCII,
	// then replaces any remaining non-alphanumeric characters with underscores.
	// This handles both properly encoded text (à → a) and mojibake artifacts (Â° → a_).
	func normalizeString(s string) string {
		var b strings.Builder
		for _, r := range strings.TrimSpace(s) {
			lo := unicode.ToLower(r)
			if lo >= 'a' && lo <= 'z' || lo >= '0' && lo <= '9' {
				b.WriteRune(lo)
				continue
			}
			switch lo {
			case 'à', 'á', 'â', 'ã', 'ä', 'å':
				b.WriteByte('a')
			case 'è', 'é', 'ê', 'ë':
				b.WriteByte('e')
			case 'ì', 'í', 'î', 'ï':
				b.WriteByte('i')
			case 'ò', 'ó', 'ô', 'õ', 'ö', 'ø':
				b.WriteByte('o')
			case 'ù', 'ú', 'û', 'ü':
				b.WriteByte('u')
			case 'ý', 'ÿ':
				b.WriteByte('y')
			case 'ñ':
				b.WriteByte('n')
			case 'ç':
				b.WriteByte('c')
			default:
				b.WriteByte('_')
			}
		}
		result := nonAlphanumRe.ReplaceAllString(b.String(), "_")
		return strings.Trim(result, "_")
	}

	// --- API response types ---

	type APIResponse[T any] struct {
		Code    int    `json:"code"`
		Status  bool   `json:"status"`
		Message string `json:"message"`
		Data    T      `json:"data"`
	}

	type Event struct {
		Year           int    `json:"Year"`
		TeamCode       int    `json:"TeamCode"`
		Description    string `json:"Description"`
		Data           string `json:"Data"`
		DSC            string `json:"DSC"`
		ID             int    `json:"ID"`
		ShowID         int    `json:"ShowID"`
		ProgramVersion string `json:"ProgramVersion"`
		PoolLength     int    `json:"pi_LunghezzaVasca"`
		Lanes          int    `json:"pi_NumeroCorsie"`
		Place          string `json:"Place"`
		DateRef        string `json:"ma_DataRiferimento"`
	}

	type AthleteEntry struct {
		Nome      string `json:"Nome"`
		Cognome   string `json:"Cognome"`
		Categoria string `json:"Categoria"`
		Numero    int    `json:"Numero"`
	}

	type AthleteEntryList struct {
		Entrylist []AthleteEntry `json:"entrylist"`
	}

	type AthleteInfo struct {
		Nome    string `json:"Nome"`
		Cognome string `json:"Cognome"`
		Codice  string `json:"Codice"`
		Naz     string `json:"Naz"`
		Sex     string `json:"Sex"`
		Anno    int    `json:"Anno"`
		Soc     string `json:"Soc"`
	}

	type Result struct {
		DescrGara string  `json:"DescrGara"`
		DescrCat  string  `json:"DescrCat"`
		Batteria  int     `json:"Batteria"`
		Corsia    int     `json:"Corsia"`
		NumConc   int     `json:"NumConc"`
		Metri     int     `json:"Metri"`
		Tempo     string  `json:"Tempo"`
		Punti     float64 `json:"Punti"`
		Squadra   string  `json:"Squadra"`
		Pos       int     `json:"Pos"`
		Staffetta bool    `json:"Staffetta"`
		Stato     int     `json:"Stato"`
		Categoria string  `json:"Categoria"`
	}

	type AthleteData struct {
		Atleta AthleteInfo `json:"atleta"`
		Tempi  []Result    `json:"tempi"`
	}

	// --- HTTP client with exponential backoff ---

	var httpClient = &http.Client{Timeout: 30 * time.Second}

	func fetchJSON(url string, dest interface{}) error {
		var lastErr error
		for attempt := 0; attempt < maxRetries; attempt++ {
			if attempt > 0 {
				// Exponential backoff with jitter: 1s, 2s, 4s, 8s... + random 0-500ms
				sleep := time.Duration(1<<uint(attempt-1))*time.Second + time.Duration(rand.Intn(500))*time.Millisecond
				if sleep > 60*time.Second {
					sleep = 60 * time.Second
				}
				log.Printf("[backoff] attempt %d for %s, sleeping %v", attempt+1, url, sleep)
				time.Sleep(sleep)
			}

			resp, err := httpClient.Get(url)
			if err != nil {
				lastErr = fmt.Errorf("GET %s: %w", url, err)
				continue
			}

			body, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err != nil {
				lastErr = fmt.Errorf("read body %s: %w", url, err)
				continue
			}

			if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusServiceUnavailable {
				lastErr = fmt.Errorf("rate limited (HTTP %d) on %s", resp.StatusCode, url)
				continue
			}
			if resp.StatusCode != http.StatusOK {
				lastErr = fmt.Errorf("HTTP %d for %s", resp.StatusCode, url)
				continue
			}

			if err := json.Unmarshal(body, dest); err != nil {
				lastErr = fmt.Errorf("unmarshal %s: %w", url, err)
				continue
			}
			return nil
		}
		return fmt.Errorf("exhausted %d retries for %s: %w", maxRetries, url, lastErr)
	}

	// --- Name normalization ---

	func normalizeName(nome, cognome string) string {
		return normalizeString(cognome + " " + nome)
	}

	func normalizeEventDir(event Event) string {
		return normalizeString(fmt.Sprintf("%d %s", event.ShowID, event.Description))
	}

	// isEventComplete returns true if the event directory already contains info.json
	// plus exactly one file per expected athlete, indicating a complete prior download.
	func isEventComplete(dir string, athleteCount int) bool {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return false
		}
		jsonCount := 0
		hasInfo := false
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			jsonCount++
			if e.Name() == "info.json" {
				hasInfo = true
			}
		}
		log.Printf("Has info: %v, Count: %v, Athletes: %v", hasInfo, jsonCount, athleteCount+1)
		return hasInfo && jsonCount == (athleteCount+1)
	}

	// --- Writers ---

	func writeJSON(path string, v interface{}) error {
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

	// --- Scraping logic ---

	func fetchEvents(year int) ([]Event, error) {
		url := fmt.Sprintf("%s/schedule/%d/*/*", baseURL, year)
		var resp APIResponse[[]Event]
		if err := fetchJSON(url, &resp); err != nil {
			return nil, err
		}
		return resp.Data, nil
	}

	func fetchAthletes(year, teamCode, showID int) ([]AthleteEntry, error) {
		url := fmt.Sprintf("%s/allathletes/%d/%d/%d", baseURL, year, teamCode, showID)
		var resp APIResponse[AthleteEntryList]
		if err := fetchJSON(url, &resp); err != nil {
			return nil, err
		}
		return resp.Data.Entrylist, nil
	}

	func fetchAthleteResults(year, teamCode, showID, numero int) (*AthleteData, error) {
		url := fmt.Sprintf("%s/atleta/%d/%d/%d/%d", baseURL, year, teamCode, showID, numero)
		var resp APIResponse[AthleteData]
		if err := fetchJSON(url, &resp); err != nil {
			return nil, err
		}
		return &resp.Data, nil
	}

	// --- Worker pool ---

	type athleteJob struct {
		event    Event
		eventDir string
		entry    AthleteEntry
	}

	func processAthlete(job athleteJob) {
		filename := normalizeName(job.entry.Nome, job.entry.Cognome) + ".json"
		path := filepath.Join(job.eventDir, filename)

		if _, err := os.Stat(path); err == nil {
			log.Printf("\033[31m[error] %s already exists, skipping %s %s\033[0m",
				path, job.entry.Nome, job.entry.Cognome)
			return
		}

		data, err := fetchAthleteResults(job.event.Year, job.event.TeamCode, job.event.ShowID, job.entry.Numero)
		if err != nil {
			log.Printf("[error] event %d athlete %d (%s %s): %v",
				job.event.ShowID, job.entry.Numero, job.entry.Nome, job.entry.Cognome, err)
			return
		}
		if err := writeJSON(path, data); err != nil {
			log.Printf("[error] write %s: %v", path, err)
			return
		}
		log.Printf("[ok] %s", path)
	}

	func main() {
	year := 2022

	log.Printf("Fetching events for year %d...", year)
	events, err := fetchEvents(year)
	if err != nil {
		log.Fatalf("Failed to fetch events: %v", err)
	}
	log.Printf("Found %d events", len(events))

	jobs := make(chan athleteJob, 100)
	var wg sync.WaitGroup

	// Start worker pool
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				processAthlete(job)
			}
		}()
	}

	// Enqueue work
	for _, event := range events {
		//if !strings.Contains(event.DSC, "MEETING CITTA' DI MONTEROTONDO") {
		//	continue
		//}
		eventDir := filepath.Join(outputDir, normalizeEventDir(event))

		athletes, err := fetchAthletes(event.Year, event.TeamCode, event.ShowID)
		if err != nil {
			log.Printf("[error] fetch athletes for event %d: %v", event.ShowID, err)
			continue
		}

		if isEventComplete(eventDir, len(athletes)) {
			log.Printf("[skip] %d: %s (%d athletes already saved)", event.ShowID, event.Description, len(athletes))
			continue
		}

		log.Printf("[event] %d: %s -> %s (%d athletes)", event.ShowID, normalizeString(event.Description), eventDir, len(athletes))

		infoPath := filepath.Join(eventDir, "info.json")
		if err := writeJSON(infoPath, event); err != nil {
			log.Printf("[error] write info.json for event %d: %v", event.ShowID, err)
			continue
		}

		for _, athlete := range athletes {
			jobs <- athleteJob{
				event:    event,
				eventDir: eventDir,
				entry:    athlete,
			}
		}
	}

	close(jobs)
	wg.Wait()
	log.Println("Done.")
}
