package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"nuoto/internal/strutil"
	"nuoto/internal/worker"
)

// ─── Aggregated on-disk types ─────────────────────────────────────────────────

type aggCompetition struct {
	Name     string   `json:"name"`
	Year     int      `json:"year"`
	Dates    []string `json:"dates"`
	Pool     string   `json:"pool"`
	Location string   `json:"location"`
	Source   string   `json:"source"`
	ID       string   `json:"id"`
}

type aggAthlete struct {
	Name        string      `json:"name"`
	YearOfBirth string      `json:"year_of_birth"`
	Sex         string      `json:"sex"`
	Society     string      `json:"society"`
	Nationality string      `json:"nationality"`
	Source      string      `json:"source"`
	Results     []aggResult `json:"results"`
}

type aggResult struct {
	Event    string  `json:"event"`
	Category string  `json:"category"`
	Time     string  `json:"time"`
	Position int     `json:"position"`
	Splits   []split `json:"splits"`
}

type split struct {
	Metres int    `json:"metres"`
	Time   string `json:"time"`
}

// ─── Output types ─────────────────────────────────────────────────────────────

// AthleteMatch is the result of a search command entry.
type AthleteMatch struct {
	Name      string   `json:"name"`
	Club      string   `json:"club"`
	BirthYear string   `json:"birth_year"`
	Sex       string   `json:"sex"`
	Events    []string `json:"events"`
}

// ResultItem is one race entry returned by the results command.
type ResultItem struct {
	Competition string  `json:"competition"`
	Date        string  `json:"date,omitempty"`
	Style       string  `json:"style"`
	Category    string  `json:"category,omitempty"`
	Time        string  `json:"time"`
	Position    int     `json:"position,omitempty"`
	Splits      []split `json:"splits,omitempty"`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eventDirs returns all competition directories found under dataDir
// (structure: dataDir/YEAR/COMP_DIR/).
func eventDirs(dataDir string) ([]string, error) {
	years, err := os.ReadDir(dataDir)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", dataDir, err)
	}
	var dirs []string
	for _, y := range years {
		if !y.IsDir() {
			continue
		}
		comps, err := os.ReadDir(filepath.Join(dataDir, y.Name()))
		if err != nil {
			continue
		}
		for _, c := range comps {
			if c.IsDir() {
				dirs = append(dirs, filepath.Join(dataDir, y.Name(), c.Name()))
			}
		}
	}
	return dirs, nil
}

// candidateFilenames derives the filenames to probe for a multi-word query
// without scanning every file in the directory.
// Athlete files are named Normalize(cognome + "_" + nome) or similar, so we
// try every split of the query words in both orders.
// Returns nil for single-word queries, which require a full directory scan.
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
		add(strutil.Normalize(a+" "+b) + ".json")
		add(strutil.Normalize(b+" "+a) + ".json")
	}
	return out
}

// athletePathsInDir returns the JSON athlete file paths to read in dir.
// When candidates are provided it probes only those files; otherwise it lists
// all non-special JSON files.
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
		if e.IsDir() || strings.HasPrefix(e.Name(), ".") ||
			!strings.HasSuffix(e.Name(), ".json") || e.Name() == "info.json" {
			continue
		}
		paths = append(paths, filepath.Join(dir, e.Name()))
	}
	return paths
}

func loadJSON(path string, v any) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewDecoder(f).Decode(v)
}

// nameMatches reports whether the athlete name contains the query string
// (case-insensitive, checking both "nome cognome" and "cognome nome" orderings).
func nameMatches(name, query string) bool {
	q := strings.ToLower(query)
	n := strings.ToLower(name)
	if strings.Contains(n, q) {
		return true
	}
	// Also check reversed word order.
	words := strings.Fields(n)
	if len(words) >= 2 {
		reversed := make([]string, len(words))
		copy(reversed, words)
		for i, j := 0, len(reversed)-1; i < j; i, j = i+1, j-1 {
			reversed[i], reversed[j] = reversed[j], reversed[i]
		}
		if strings.Contains(strings.Join(reversed, " "), q) {
			return true
		}
	}
	return false
}

const maxWorkers = 32

// ─── Commands ─────────────────────────────────────────────────────────────────

type searchHit struct {
	key   string
	match AthleteMatch
}

// cmdSearch lists unique athletes whose name contains the query string.
func cmdSearch(dataDir, query string) error {
	dirs, err := eventDirs(dataDir)
	if err != nil {
		return err
	}
	candidates := candidateFilenames(query)

	hits := make(chan []searchHit, len(dirs))
	sem := worker.NewSemaphore(maxWorkers)
	var wg sync.WaitGroup

	for _, dir := range dirs {
		wg.Add(1)
		go func(dir string) {
			defer wg.Done()
			sem.Acquire()
			defer sem.Release()

			var comp aggCompetition
			if err := loadJSON(filepath.Join(dir, "info.json"), &comp); err != nil {
				hits <- nil
				return
			}

			var local []searchHit
			for _, p := range athletePathsInDir(dir, candidates) {
				var a aggAthlete
				if err := loadJSON(p, &a); err != nil || a.Name == "" {
					continue
				}
				if !nameMatches(a.Name, query) {
					continue
				}
				local = append(local, searchHit{
					key: strings.ToUpper(a.Name),
					match: AthleteMatch{
						Name:      a.Name,
						Club:      a.Society,
						BirthYear: a.YearOfBirth,
						Sex:       a.Sex,
						Events:    []string{comp.Name},
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

// cmdResults returns all results for athletes matching the query.
func cmdResults(dataDir, query string) error {
	dirs, err := eventDirs(dataDir)
	if err != nil {
		return err
	}
	candidates := candidateFilenames(query)

	items := make(chan []ResultItem, len(dirs))
	sem := worker.NewSemaphore(maxWorkers)
	var wg sync.WaitGroup

	for _, dir := range dirs {
		wg.Add(1)
		go func(dir string) {
			defer wg.Done()
			sem.Acquire()
			defer sem.Release()

			var comp aggCompetition
			if err := loadJSON(filepath.Join(dir, "info.json"), &comp); err != nil {
				items <- nil
				return
			}

			date := ""
			if len(comp.Dates) > 0 {
				date = comp.Dates[0]
			}

			var local []ResultItem
			for _, p := range athletePathsInDir(dir, candidates) {
				var a aggAthlete
				if err := loadJSON(p, &a); err != nil || a.Name == "" {
					continue
				}
				if !nameMatches(a.Name, query) {
					continue
				}
				for _, r := range a.Results {
					local = append(local, ResultItem{
						Competition: comp.Name,
						Date:        date,
						Style:       r.Event,
						Category:    r.Category,
						Time:        r.Time,
						Position:    r.Position,
						Splits:      r.Splits,
					})
				}
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

// ─── Main ─────────────────────────────────────────────────────────────────────

func usage() {
	fmt.Fprintf(os.Stderr, `Usage:
  query search <name>    List athletes whose name contains <name>
  query results <name>   Show all results for athletes matching <name>

Flags:
  -data <dir>   Path to aggregated data directory (default: "aggregated")
`)
}

func main() {
	dataDir := flag.String("data", "aggregated", "path to aggregated data directory")
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
