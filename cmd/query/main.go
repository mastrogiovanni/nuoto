package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"nuoto/internal/strutil"
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
	Source      string  `json:"source,omitempty"`
	Date        string  `json:"date,omitempty"`
	Style       string  `json:"style"`
	Category    string  `json:"category,omitempty"`
	Time        string  `json:"time"`
	Position    int     `json:"position,omitempty"`
	Splits      []split `json:"splits,omitempty"`
	FilePath    string  `json:"file_path"`
}

// ─── Index types ──────────────────────────────────────────────────────────────

type athleteIndexEntry struct {
	Path        string `json:"path"`
	Competition string `json:"competition"`
	Date        string `json:"date,omitempty"`
}

type athleteIndex struct {
	Name        string              `json:"name"`
	YearOfBirth string              `json:"year_of_birth"`
	Sex         string              `json:"sex"`
	Society     string              `json:"society"`
	Files       []athleteIndexEntry `json:"files"`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// indexEntries returns all athlete index files found in dataDir/_index/.
func indexEntries(dataDir string) ([]string, error) {
	indexDir := filepath.Join(dataDir, "_index")
	entries, err := os.ReadDir(indexDir)
	if err != nil {
		return nil, fmt.Errorf("index not found at %s (run aggregator first): %w", indexDir, err)
	}
	var paths []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			paths = append(paths, filepath.Join(indexDir, e.Name()))
		}
	}
	return paths, nil
}

func loadJSON(path string, v any) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewDecoder(f).Decode(v)
}

// filenameMatches reports whether the index file stem (filename without .json)
// matches the query. Index files are named "surname_name", so we check both
// normalize(query) and normalize(reversed query) as substrings of the stem.
func filenameMatches(stem, query string) bool {
	norm := strutil.Normalize(query)
	words := strings.Fields(query)
	for i, j := 0, len(words)-1; i < j; i, j = i+1, j-1 {
		words[i], words[j] = words[j], words[i]
	}
	normRev := strutil.Normalize(strings.Join(words, " "))
	return strings.Contains(stem, norm) || strings.Contains(stem, normRev)
}

// ─── Commands ─────────────────────────────────────────────────────────────────

// cmdSearch lists unique athletes whose name contains the query string.
func cmdSearch(dataDir, query string) error {
	paths, err := indexEntries(dataDir)
	if err != nil {
		return err
	}

	seen := map[string]*AthleteMatch{}
	for _, p := range paths {
		stem := strings.TrimSuffix(filepath.Base(p), ".json")
		if !filenameMatches(stem, query) {
			continue
		}
		var ai athleteIndex
		if err := loadJSON(p, &ai); err != nil || ai.Name == "" {
			continue
		}
		key := strings.ToUpper(ai.Name)
		var events []string
		for _, f := range ai.Files {
			events = append(events, f.Competition)
		}
		if m, ok := seen[key]; ok {
			m.Events = append(m.Events, events...)
		} else {
			seen[key] = &AthleteMatch{
				Name:      ai.Name,
				Club:      ai.Society,
				BirthYear: ai.YearOfBirth,
				Sex:       ai.Sex,
				Events:    events,
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
	paths, err := indexEntries(dataDir)
	if err != nil {
		return err
	}

	var all []ResultItem
	for _, p := range paths {
		stem := strings.TrimSuffix(filepath.Base(p), ".json")
		if !filenameMatches(stem, query) {
			continue
		}
		var ai athleteIndex
		if err := loadJSON(p, &ai); err != nil || ai.Name == "" {
			continue
		}
		for _, f := range ai.Files {
			athletePath := filepath.Join(dataDir, f.Path)
			var a aggAthlete
			if err := loadJSON(athletePath, &a); err != nil {
				continue
			}
			// Load competition info from the same directory.
			compDir := filepath.Dir(athletePath)
			var comp aggCompetition
			_ = loadJSON(filepath.Join(compDir, "info.json"), &comp)

			date := f.Date
			if date == "" && len(comp.Dates) > 0 {
				date = comp.Dates[0]
			}
			compName := f.Competition
			if compName == "" {
				compName = comp.Name
			}

			for _, r := range a.Results {
				all = append(all, ResultItem{
					Competition: compName,
					Source:      comp.Source,
					Date:        date,
					Style:       r.Event,
					Category:    r.Category,
					Time:        r.Time,
					Position:    r.Position,
					Splits:      r.Splits,
					FilePath:    athletePath,
				})
			}
		}
	}

	italianMonths := map[string]int{
		"gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
		"maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
		"settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
	}
	parseDMY := func(s string) (y, m, d int) {
		parts := strings.Fields(s)
		if len(parts) == 3 {
			fmt.Sscanf(parts[0], "%d", &d)
			m = italianMonths[strings.ToLower(parts[1])]
			fmt.Sscanf(parts[2], "%d", &y)
			return
		}
		fmt.Sscanf(s, "%d/%d/%d", &d, &m, &y)
		return
	}
	sort.Slice(all, func(i, j int) bool {
		yi, mi, di := parseDMY(all[i].Date)
		yj, mj, dj := parseDMY(all[j].Date)
		if yi != yj {
			return yi < yj
		}
		if mi != mj {
			return mi < mj
		}
		return di < dj
	})

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
