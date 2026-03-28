package main

import (
	"log"
	"net/url"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type Collegamento struct {
	Stile       string `json:"stile"`
	IDEvento    string `json:"id_evento"`
	CodiceGara  string `json:"codice_gara"`
	IDCategoria string `json:"id_categoria"`
	Sesso       string `json:"sesso"`
	View        string `json:"view"`
	Callback    string `json:"callback"`
	Alias       string `json:"alias"`
}

func parseCollegamenti(htmlStr string) ([]Collegamento, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlStr))
	if err != nil {
		return nil, err
	}

	var items []Collegamento

	doc.Find("span.collegamento").Each(func(_ int, s *goquery.Selection) {
		dataID, _ := s.Attr("data-id")
		view, _ := s.Attr("data-view")
		callback, _ := s.Attr("data-callbk")
		alias, _ := s.Attr("data-alias")
		stile := strings.TrimSpace(s.Text())

		// data-id format: id_evento;codice_gara;id_categoria;sesso
		parts := strings.Split(dataID, ";")
		var idEvento, codiceGara, idCategoria, sesso string
		if len(parts) == 4 {
			idEvento = parts[0]
			codiceGara = parts[1]
			idCategoria = parts[2]
			sesso = parts[3]
		}

		items = append(items, Collegamento{
			Stile:       stile,
			IDEvento:    idEvento,
			CodiceGara:  codiceGara,
			IDCategoria: idCategoria,
			Sesso:       sesso,
			View:        view,
			Callback:    callback,
			Alias:       alias,
		})
	})

	return items, nil
}

func GetGaraFromEvento(idEvento string) ([]Collegamento, error) {

	apiURL := "https://www.federnuoto.it/index.php?option=com_solrconnect&currentpage=1&view=risultati&format=json"

	formData := url.Values{}
	formData.Set("solr[id_settore]", "1")
	formData.Set("solr[id_tipologia_1]", "1")
	formData.Set("solr[stagione]", "2025")
	formData.Set("solr[id_tipo_organizzatore]", "")
	formData.Set("solr[mese]", "")
	formData.Set("solr[luogo]", "")
	formData.Set("solr[descrizione]", "")
	formData.Set("solr[corsi_passati]", "0")
	formData.Set("solr[id_evento]", idEvento)

	response, err := QueryFedernuoto(apiURL, formData)
	if err != nil {
		log.Fatalf("error fetching events: %v", err)
	}

	items, err := parseCollegamenti(response.Content)
	if err != nil {
		log.Fatalf("error parsing HTML content: %v", err)
	}

	return items, nil
}
