package main

import (
	"fmt"
	"log"
	"nuoto/internal/ficr"
	"nuoto/internal/worker"
	"os"
	"path/filepath"
	"strconv"
)

const workers = 5

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintf(os.Stderr, "usage: %s <year>\n", os.Args[0])
		os.Exit(1)
	}
	year, err := strconv.Atoi(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid year %q: %v\n", os.Args[1], err)
		os.Exit(1)
	}
	outputDir := fmt.Sprintf("data_ficr/%d", year)

	log.Printf("Fetching events for year %d...", year)
	events, err := ficr.FetchEvents(year)
	if err != nil {
		log.Fatalf("Failed to fetch events: %v", err)
	}
	log.Printf("Found %d events", len(events))

	for _, event := range events {
		eventDir := filepath.Join(outputDir, ficr.NormalizeEventDir(event))

		if ficr.IsTerminated(eventDir) {
			log.Printf("[skip] %d: %s (terminated)", event.ShowID, event.Description)
			continue
		}

		athletes, err := ficr.FetchAthletes(event.Year, event.TeamCode, event.ShowID)
		if err != nil {
			log.Printf("[error] fetch athletes for event %d: %v", event.ShowID, err)
			continue
		}

		if ficr.IsEventComplete(eventDir, len(athletes)) {
			err := ficr.WriteTerminated(eventDir) // ensure .terminated exists
			if err != nil {
				log.Printf("[error] write .terminated for event %d: %v", event.ShowID, err)
			}
			log.Printf("[skip] %d: %s (%d athletes already saved)", event.ShowID, event.Description, len(athletes))
			continue
		}

		log.Printf("[event] %d: %s -> %s (%d athletes)", event.ShowID, event.Description, eventDir, len(athletes))

		infoPath := filepath.Join(eventDir, "info.json")
		if err := ficr.WriteJSON(infoPath, event); err != nil {
			log.Printf("[error] write info.json for event %d: %v", event.ShowID, err)
			continue
		}

		jobs := make(chan ficr.AthleteJob, len(athletes))
		for _, athlete := range athletes {
			jobs <- ficr.AthleteJob{
				Event:    event,
				EventDir: eventDir,
				Entry:    athlete,
			}
		}
		close(jobs)

		failures := worker.RunPoolCounted(workers, jobs, ficr.ProcessAthlete)
		if failures == 0 {
			if err := ficr.WriteTerminated(eventDir); err != nil {
				log.Printf("[error] write .terminated for event %d: %v", event.ShowID, err)
			} else {
				log.Printf("[terminated] %d: %s", event.ShowID, event.Description)
			}
		} else {
			log.Printf("[incomplete] %d: %s (%d failures)", event.ShowID, event.Description, failures)
		}
	}

	log.Println("Done.")
}
