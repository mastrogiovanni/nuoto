package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"nuoto/internal/federnuoto"
	"os"
)

const pageLimit = 1000 // must match the "limit" set in SearchAthletesPage

func searchAll(sesso, settore string, jsonOut bool) map[string]federnuoto.GrRicercaAthlete {

	seen := make(map[string]federnuoto.GrRicercaAthlete)
	byname := make(map[string][]string)

	for c := 'A'; c <= 'Z'; c++ {
		prefix := string(c)
		page := 1
		for {
			athletes, err := federnuoto.SearchAthletesPage(sesso, settore, prefix, page)
			if err != nil {
				log.Printf("warn: sesso=%s prefix=%s page=%d: %v", sesso, prefix, page, err)
				break
			}
			// log.Printf("%+v", athletes)
			// someNew := false
			for _, a := range athletes {
				if _, ok := byname[a.Nome]; !ok {
					byname[a.Nome] = []string{a.IDAtleta}
				} else {
					byname[a.Nome] = append(byname[a.Nome], a.IDAtleta)
					log.Println("Nome: %+v: %+v", a.Nome, byname[a.Nome])
				}

				if _, ok := seen[a.IDAtleta]; !ok {
					// someNew = true
					seen[a.IDAtleta] = a
					if !jsonOut {
						fmt.Printf("%-10s  %-1s  %s\n", a.IDAtleta, sesso, a.Nome)
					}
				}
			}
			if len(athletes) < pageLimit {
				break // last page
			}
			// if !someNew {
			// 	break // no new athletes, likely we've reached the end
			// }
			page++
			// e.Sleep(time.Second * 5)
		}
	}
	return seen
}

func main() {
	sesso := flag.String("sesso", "all", "Gender: M, F, or all")
	settore := flag.String("settore", "MAS", "Sector (default: MAS for masters)")
	jsonOut := flag.Bool("json", false, "Output as JSON array")
	flag.Parse()

	genders := []string{"M", "F"}
	if *sesso != "all" {
		genders = []string{*sesso}
	}

	all := make(map[string]federnuoto.GrRicercaAthlete)
	for _, g := range genders {
		for id, a := range searchAll(g, *settore, *jsonOut) {
			all[id] = a
		}
	}

	if *jsonOut {
		athletes := make([]map[string]string, 0, len(all))
		for id, a := range all {
			athletes = append(athletes, map[string]string{
				"id_atleta": id,
				"nome":      a.Nome,
			})
		}
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		if err := enc.Encode(athletes); err != nil {
			log.Fatal(err)
		}
		return
	}

	log.Printf("Total unique athletes found: %d", len(all))
}
