package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"unicode"
)

// --- Data types (mirrors scraper structs) ---

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

type EventInfo struct {
	Description string `json:"Description"`
	Data        string `json:"Data"`
	Place       string `json:"Place"`
	ID          int    `json:"ID"`
}

// --- Output types ---

type Split struct {
	Metres int    `json:"metres"`
	Time   string `json:"time"`
}

// ResultItem represents one race entry for an athlete.
// Time is either a string (single entry) or []Split (grouped splits).
type ResultItem struct {
	Event    string          `json:"event"`
	Date     string          `json:"date"`
	Style    string          `json:"style"`
	Category string          `json:"category"`
	Time     json.RawMessage `json:"time"`
}

type AthleteMatch struct {
	Name      string   `json:"name"`
	Club      string   `json:"club"`
	BirthYear int      `json:"birth_year"`
	Sex       string   `json:"sex"`
	Events    []string `json:"events"`
}

// --- Name normalization (mirrors scraper logic) ---

var nonAlphanumRe = regexp.MustCompile(`[^a-z0-9]+`)

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

// candidateFilenames derives the set of filenames to probe directly for a query.
// The scraper stores athlete files as normalizeString(cognome + " " + nome) + ".json".
// For a multi-word query we try every split into (cognome, nome) and both orderings.
// Returns nil for single-word queries: those require a full directory scan.
func candidateFilenames(query string) []string {
	words := strings.Fields(query)
	if len(words) < 2 {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	add := func(f string) {
		if !seen[f] {
			seen[f] = true
			out = append(out, f)
		}
	}
	for i := 1; i < len(words); i++ {
		a := strings.Join(words[:i], " ")
		b := strings.Join(words[i:], " ")
		add(normalizeString(a+" "+b) + ".json")
		add(normalizeString(b+" "+a) + ".json")
	}
	return out
}

// athletePathsInDir returns the file paths to read in dir.
// When candidates are provided it probes only those files (O(1) stat per candidate).
// Otherwise it falls back to a full directory listing.
func athletePathsInDir(dir string, candidates []string) []string {
	if len(candidates) > 0 {
		var paths []string
		for _, c := range candidates {
			p := filepath.Join(dir, c)
			if _, err := os.Stat(p); err == nil {
				paths = append(paths, p)
			}
		}
		return paths
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var paths []string
	for _, e := range entries {
		if e.IsDir() || e.Name() == "info.json" || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		paths = append(paths, filepath.Join(dir, e.Name()))
	}
	return paths
}

// --- Helpers ---

func loadJSON(path string, v interface{}) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewDecoder(f).Decode(v)
}

func nameMatches(atleta AthleteInfo, query string) bool {
	q := strings.ToLower(query)
	nome := strings.ToLower(atleta.Nome)
	cognome := strings.ToLower(atleta.Cognome)
	full := nome + " " + cognome
	fullRev := cognome + " " + nome
	return strings.Contains(nome, q) ||
		strings.Contains(cognome, q) ||
		strings.Contains(full, q) ||
		strings.Contains(fullRev, q)
}

func eventDirs(dataDir string) ([]string, error) {
	top, err := os.ReadDir(dataDir)
	if err != nil {
		return nil, fmt.Errorf("reading data dir %s: %w", dataDir, err)
	}
	var dirs []string
	for _, e := range top {
		if !e.IsDir() {
			continue
		}
		sub := filepath.Join(dataDir, e.Name())
		children, err := os.ReadDir(sub)
		if err != nil {
			continue
		}
		isYearDir := false
		for _, c := range children {
			if c.IsDir() {
				if _, err := os.Stat(filepath.Join(sub, c.Name(), "info.json")); err == nil {
					isYearDir = true
					break
				}
			}
		}
		if isYearDir {
			for _, c := range children {
				if c.IsDir() {
					dirs = append(dirs, filepath.Join(sub, c.Name()))
				}
			}
		} else {
			dirs = append(dirs, sub)
		}
	}
	return dirs, nil
}

// aggregateTempi groups consecutive Result entries with the same DescrGara.
// Single-entry groups produce a JSON string time; multi-entry groups produce a []Split.
func aggregateTempi(tempi []Result, eventName, eventDate string) []ResultItem {
	var items []ResultItem
	i := 0
	for i < len(tempi) {
		gara := tempi[i].DescrGara
		j := i + 1
		for j < len(tempi) && tempi[j].DescrGara == gara {
			j++
		}
		group := tempi[i:j]

		var timeRaw json.RawMessage
		if len(group) == 1 {
			b, _ := json.Marshal(group[0].Tempo)
			timeRaw = b
		} else {
			splits := make([]Split, len(group))
			for k, r := range group {
				splits[k] = Split{Metres: r.Metri, Time: r.Tempo}
			}
			b, _ := json.Marshal(splits)
			timeRaw = b
		}

		items = append(items, ResultItem{
			Event:    eventName,
			Date:     eventDate,
			Style:    gara,
			Category: group[0].DescrCat,
			Time:     timeRaw,
		})
		i = j
	}
	return items
}

// maxWorkers caps the number of goroutines reading event directories concurrently.
const maxWorkers = 32

// --- Commands ---

type searchHit struct {
	key   string
	match AthleteMatch
}

// cmdSearch lists unique athletes whose name contains the query string.
// Event directories are processed in parallel; when the query is a full name,
// only the normalized filename is probed instead of scanning every file.
func cmdSearch(dataDir, query string) error {
	dirs, err := eventDirs(dataDir)
	if err != nil {
		return err
	}

	candidates := candidateFilenames(query)

	hits := make(chan []searchHit, len(dirs))
	sem := make(chan struct{}, maxWorkers)
	var wg sync.WaitGroup

	for _, dir := range dirs {
		wg.Add(1)
		go func(dir string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			var info EventInfo
			if err := loadJSON(filepath.Join(dir, "info.json"), &info); err != nil {
				hits <- nil
				return
			}

			var local []searchHit
			for _, p := range athletePathsInDir(dir, candidates) {
				var data AthleteData
				if err := loadJSON(p, &data); err != nil {
					continue
				}
				if !nameMatches(data.Atleta, query) {
					continue
				}
				local = append(local, searchHit{
					key: strings.ToUpper(data.Atleta.Cognome + " " + data.Atleta.Nome),
					match: AthleteMatch{
						Name:      data.Atleta.Nome + " " + data.Atleta.Cognome,
						Club:      data.Atleta.Soc,
						BirthYear: data.Atleta.Anno,
						Sex:       data.Atleta.Sex,
						Events:    []string{info.Description},
					},
				})
			}
			hits <- local
		}(dir)
	}

	go func() {
		wg.Wait()
		close(hits)
	}()

	seen := map[string]*AthleteMatch{}
	for batch := range hits {
		for _, h := range batch {
			if m, ok := seen[h.key]; ok {
				m.Events = append(m.Events, h.match.Events...)
			} else {
				cp := h.match
				seen[h.key] = &cp
			}
		}
	}

	if len(seen) == 0 {
		fmt.Fprintf(os.Stderr, "No athletes found matching %q\n", query)
		return nil
	}

	results := make([]*AthleteMatch, 0, len(seen))
	for _, m := range seen {
		results = append(results, m)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(results)
}

// cmdResults returns all aggregated results for athletes matching the query.
// Event directories are processed in parallel; when the query is a full name,
// only the normalized filename is probed instead of scanning every file.
func cmdResults(dataDir, query string) error {
	dirs, err := eventDirs(dataDir)
	if err != nil {
		return err
	}

	candidates := candidateFilenames(query)

	items := make(chan []ResultItem, len(dirs))
	sem := make(chan struct{}, maxWorkers)
	var wg sync.WaitGroup

	for _, dir := range dirs {
		wg.Add(1)
		go func(dir string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			var info EventInfo
			if err := loadJSON(filepath.Join(dir, "info.json"), &info); err != nil {
				items <- nil
				return
			}

			var local []ResultItem
			for _, p := range athletePathsInDir(dir, candidates) {
				var data AthleteData
				if err := loadJSON(p, &data); err != nil {
					continue
				}
				if !nameMatches(data.Atleta, query) {
					continue
				}
				local = append(local, aggregateTempi(data.Tempi, info.Description, info.Data)...)
			}
			items <- local
		}(dir)
	}

	go func() {
		wg.Wait()
		close(items)
	}()

	var all []ResultItem
	for batch := range items {
		all = append(all, batch...)
	}

	if len(all) == 0 {
		fmt.Fprintf(os.Stderr, "No results found for %q\n", query)
		return nil
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(all)
}

// --- Main ---

func usage() {
	fmt.Fprintf(os.Stderr, `Usage:
  query search <name>    List athletes whose name contains <name>
  query results <name>   Show all results for athletes matching <name>

Flags:
  -data <dir>    Path to data directory (default: "data")
`)
}

func main() {
	dataDir := flag.String("data", "data", "path to data directory")
	flag.Parse()

	args := flag.Args()
	if len(args) < 2 {
		usage()
		os.Exit(1)
	}

	subcmd := args[0]
	query := strings.Join(args[1:], " ")

	var err error
	switch subcmd {
	case "search":
		err = cmdSearch(*dataDir, query)
	case "results":
		err = cmdResults(*dataDir, query)
	default:
		fmt.Fprintf(os.Stderr, "Unknown command %q\n\n", subcmd)
		usage()
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
