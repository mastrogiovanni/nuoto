package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type eventInfo struct {
	Name string `json:"name"`
	ID   string `json:"id"`
}

// countJSONFiles returns the number of .json files in dir, excluding info.json.
func countJSONFiles(dir string) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".json" && e.Name() != "info.json" {
			count++
		}
	}
	return count
}

func readInfo(path string) (eventInfo, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return eventInfo{}, err
	}
	var info eventInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return eventInfo{}, err
	}
	return info, nil
}

func main() {
	dataRoot := "aggregated"
	if len(os.Args) == 2 {
		dataRoot = os.Args[1]
	}

	years, err := os.ReadDir(dataRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error reading %s: %v\n", dataRoot, err)
		os.Exit(1)
	}

	for _, yearEntry := range years {
		if !yearEntry.IsDir() {
			continue
		}
		year := yearEntry.Name()
		yearDir := filepath.Join(dataRoot, year)

		competitions, err := os.ReadDir(yearDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error reading %s: %v\n", yearDir, err)
			continue
		}

		var partial []string
		for _, compEntry := range competitions {
			if !compEntry.IsDir() {
				continue
			}
			compDir := filepath.Join(yearDir, compEntry.Name())
			infoPath := filepath.Join(compDir, "info.json")

			info, err := readInfo(infoPath)
			if err != nil {
				// no info.json — use directory name as fallback
				info.Name = compEntry.Name()
			}

			if n := countJSONFiles(compDir); n <= 5 {
				partial = append(partial, fmt.Sprintf("  - [%s] %s (%d athletes)", info.ID, info.Name, n))
			}
		}

		if len(partial) > 0 {
			fmt.Printf("Year %s — %d partial competition(s):\n", year, len(partial))
			for _, s := range partial {
				fmt.Println(s)
			}
			fmt.Println()
		} else {
			fmt.Printf("Year %s — all competitions complete.\n", year)
		}
	}
}
