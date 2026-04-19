// cmd/federnuoto_records downloads and parses Federnuoto records pages,
// writing one JSON file per page.
//
// Usage:
//
//	go run ./cmd/federnuoto_records -url https://www.federnuoto.it/home/nuoto/records/vasca-25m/assoluti-maschili.html
//	go run ./cmd/federnuoto_records -url URL -out records.json
//	go run ./cmd/federnuoto_records -all -dir ./data_federnuoto_records
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"nuoto/internal/federnuoto"
	"os"
	"path/filepath"
	"strings"
)

const baseURL = "https://www.federnuoto.it"

// knownPaths lists all relative record page paths from the Federnuoto nav menu.
var knownPaths = []string{
	// Vasca 25m
	"/home/nuoto/records/vasca-25m/assoluti-maschili.html",
	"/home/nuoto/records/vasca-25m/assoluti-femminili.html",
	// Vasca 50m
	"/home/nuoto/records/vasca-50m/mondiali-maschili.html",
	"/home/nuoto/records/vasca-50m/mondiali-femminili.html",
	"/home/nuoto/records/vasca-50m/europei-maschili.html",
	"/home/nuoto/records/vasca-50m/europei-femminili.html",
	"/home/nuoto/records/vasca-50m/olimpici-maschili.html",
	"/home/nuoto/records/vasca-50m/olimpici-femminili.html",
	"/home/nuoto/records/vasca-50m/assoluti-maschili.html",
	"/home/nuoto/records/vasca-50m/assoluti-femminili.html",
	"/home/nuoto/records/vasca-50m/cadetti-maschi.html",
	"/home/nuoto/records/vasca-50m/cadetti-femminili.html",
	"/home/nuoto/records/vasca-50m/juniores-maschili.html",
	"/home/nuoto/records/vasca-50m/juniores-femminili.html",
	"/home/nuoto/records/vasca-50m/ragazzi-maschili.html",
	"/home/nuoto/records/vasca-50m/ragazzi-femminili.html",
	"/home/nuoto/records/vasca-50m/ragazzi-maschili-14-anni.html",
	"/home/nuoto/records/vasca-50m/maschili-trofeo-settecolli.html",
	"/home/nuoto/records/vasca-50m/femminili-trofeo-settecolli.html",
}

// pathToFilename converts a relative URL path to a JSON filename.
// e.g. "/home/nuoto/records/vasca-25m/assoluti-maschili.html" → "vasca-25m_assoluti-maschili.json"
func pathToFilename(path string) string {
	path = strings.TrimSuffix(path, ".html")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	// Use the last two segments: pool type + record type
	if len(parts) >= 2 {
		parts = parts[len(parts)-2:]
	}
	return strings.Join(parts, "_") + ".json"
}

func main() {
	pageURL := flag.String("url", "", "URL of a single records page to scrape")
	outFile := flag.String("out", "", "output JSON file (default: stdout)")
	scrapeAll := flag.Bool("all", false, "scrape all known records pages")
	outDir := flag.String("dir", "./data_federnuoto_records", "output directory when using -all")
	flag.Parse()

	if *scrapeAll {
		if err := os.MkdirAll(*outDir, 0755); err != nil {
			log.Fatalf("mkdir %s: %v", *outDir, err)
		}
		for _, rel := range knownPaths {
			url := baseURL + rel
			filename := pathToFilename(rel)
			log.Printf("fetching %s", url)
			page, err := federnuoto.FetchRecords(url)
			if err != nil {
				log.Printf("[error] %s: %v", url, err)
				continue
			}
			path := filepath.Join(*outDir, filename)
			if err := writeJSON(path, page); err != nil {
				log.Printf("[error] write %s: %v", path, err)
				continue
			}
			log.Printf("[ok] %s → %s (%d records)", page.Title, path, len(page.Records))
		}
		return
	}

	if *pageURL == "" {
		fmt.Fprintln(os.Stderr, "usage: federnuoto_records -url URL [-out FILE]")
		fmt.Fprintln(os.Stderr, "       federnuoto_records -all [-dir DIR]")
		os.Exit(1)
	}

	page, err := federnuoto.FetchRecords(*pageURL)
	if err != nil {
		log.Fatalf("fetch records: %v", err)
	}

	if *outFile != "" {
		if err := writeJSON(*outFile, page); err != nil {
			log.Fatalf("write %s: %v", *outFile, err)
		}
		log.Printf("[ok] %s → %s (%d records)", page.Title, *outFile, len(page.Records))
		return
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(page); err != nil {
		log.Fatalf("encode JSON: %v", err)
	}
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
