package main

import (
	"flag"
	"fmt"
	"log"
	"nuoto/internal/federnuoto"
)

func main() {
	sesso := flag.String("sesso", "M", "Gender (M/F)")
	settore := flag.String("settore", "MAS", "Sector (e.g. MAS for masters)")
	cognome := flag.String("cognome", "", "Athlete surname")
	idAtleta := flag.String("id", "", "Athlete ID (required without -search)")
	search := flag.Bool("search", false, "Search athletes by surname instead of fetching personal bests")
	debug := flag.Bool("debug", false, "Print raw HTML content returned by the API")
	flag.Parse()

	if *cognome == "" {
		log.Fatal("usage: gratleta -cognome <surname> [-search] [-id <athlete_id>] [-sesso M|F] [-settore MAS] [-debug]")
	}

	if *search {
		athletes, err := federnuoto.SearchAthletes(*sesso, *settore, *cognome)
		if err != nil {
			log.Fatal(err)
		}
		if len(athletes) == 0 {
			fmt.Println("no athletes found")
			return
		}
		fmt.Printf("%-10s  %s\n", "ID", "Nome")
		fmt.Println("----------  ------------------------------")
		for _, a := range athletes {
			fmt.Printf("%-10s  %s\n", a.IDAtleta, a.Nome)
		}
		return
	}

	if *idAtleta == "" {
		log.Fatal("-id <athlete_id> is required when not using -search")
	}

	if *debug {
		resp, err := federnuoto.QueryGratleta(*sesso, *settore, *cognome, *idAtleta)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("status: %s\n\n%s\n", resp.Status, resp.Content)
		return
	}

	res, err := federnuoto.GetGratleta(*sesso, *settore, *cognome, *idAtleta)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Atleta:  %s\n", res.Info.Nome)
	fmt.Printf("Nascita: %s\n", res.Info.DataNascita)
	fmt.Printf("Societa: %s\n\n", res.Info.Societa)

	if len(res.Rows) == 0 {
		fmt.Println("no results found")
		return
	}

	fmt.Printf("%-16s  %-20s  %-4s  %-10s  %-25s  %-30s  %s\n",
		"Vasca", "Specialita", "Cat.", "Tempo", "Data", "Luogo", "Evento")
	fmt.Println("----------------  --------------------  ----  ----------  -------------------------  ------------------------------  -----")
	for _, r := range res.Rows {
		fmt.Printf("%-16s  %-20s  %-4s  %-10s  %-25s  %-30s  %s\n",
			r.Vasca, r.Specialita, r.Categoria, r.Tempo, r.Data, r.Luogo, r.Evento)
	}
}
