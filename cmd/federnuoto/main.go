package main

import "log"

func main() {

	events_found := make(map[string]bool)

	page := 1
	for {
		events, err := GetEventsForYear("2025", page)
		if err != nil {
			log.Fatalf("error fetching events: %v", err)
		}
		if len(events) == 0 {
			log.Println("No more events found, stopping.")
			break
		}
		for _, e := range events {
			_, exists := events_found[e.ID]
			if !exists {
				log.Printf("Found event: %s %+v (ID: %s)", e.Name, e.Dates, e.ID)
				events_found[e.ID] = true
			} else {
				log.Printf("Already seen event: %s (ID: %s)", e.Name, e.ID)
			}
		}
		page = page + 1
	}

	// // 2. Parse HTML within the JSON content
	// title, results, err := parseHTML(apiResp.Content)
	// if err != nil {
	// 	log.Fatalf("Error parsing HTML: %v", err)
	// }

	// // 3. Print Results
	// fmt.Printf("--- %s ---\n", title)
	// fmt.Printf("%-4s | %-25s | %-4s | %-8s\n", "Pos", "Name", "Year", "Time")
	// fmt.Println(strings.Repeat("-", 50))
	// for _, r := range results {
	// 	fmt.Printf("%-4d | %-25s | %-4d | %-8s\n", r.Position, r.FullName, r.Year, r.Time)
	// }
}
