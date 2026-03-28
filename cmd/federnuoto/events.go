package main

import (
	"fmt"
	"log"
	"net/url"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type EventDate struct {
	Day   string `json:"day"`
	Month string `json:"month"`
	Year  string `json:"year"`
}

type Event struct {
	Dates    []EventDate `json:"dates"`
	Name     string      `json:"name"`
	Pool     string      `json:"pool"`
	Location string      `json:"location"`
	ID       string      `json:"id"`
	Alias    string      `json:"alias"`
	View     string      `json:"view"`
	Callback string      `json:"callback"`
}

func parseEvents(htmlStr string) ([]Event, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlStr))
	if err != nil {
		return nil, err
	}

	var events []Event

	doc.Find(".nat_eve_container").Each(func(_ int, s *goquery.Selection) {
		var dates []EventDate
		s.Find(".nat_eve_date").Each(func(_ int, d *goquery.Selection) {
			dates = append(dates, EventDate{
				Day:   strings.TrimSpace(d.Find(".nat_eve_d").Text()),
				Month: strings.TrimSpace(d.Find(".nat_eve_m").Text()),
				Year:  strings.TrimSpace(d.Find(".nat_eve_y").Text()),
			})
		})

		name := strings.TrimSpace(s.Find("h4.nat_eve_title span").Text())
		pool := strings.TrimSpace(s.Find(".nat_eve_pool").Text())
		location := strings.TrimSpace(s.Find(".nat_eve_loc").Text())

		dettaglio := s.Find("span.dettaglio")
		id, _ := dettaglio.Attr("data-id")
		alias, _ := dettaglio.Attr("data-alias")
		view, _ := dettaglio.Attr("data-view")
		callback, _ := dettaglio.Attr("data-callbk")

		events = append(events, Event{
			Dates:    dates,
			Name:     name,
			Pool:     pool,
			Location: location,
			ID:       id,
			Alias:    alias,
			View:     view,
			Callback: callback,
		})
	})

	return events, nil
}

func GetEventsForYear(year string, page int) ([]Event, error) {

	apiURL := fmt.Sprintf("https://www.federnuoto.it/index.php?option=com_solrconnect&currentpage=%d&view=calendario&format=json", page)

	formData := url.Values{}
	formData.Set("solr[id_settore]", "1")
	formData.Set("solr[id_tipologia_1]", "1")
	formData.Set("solr[stagione]", year)
	formData.Set("solr[id_tipo_organizzatore]", "")
	formData.Set("solr[mese]", "")
	formData.Set("solr[luogo]", "")
	formData.Set("solr[descrizione]", "")
	formData.Set("solr[corsi_passati]", "0")

	response, err := QueryFedernuoto(apiURL, formData)
	if err != nil {
		log.Fatalf("error fetching events: %v", err)
	}

	events, err := parseEvents(response.Content)
	if err != nil {
		log.Fatalf("error parsing HTML content: %v", err)
	}

	return events, nil
}
