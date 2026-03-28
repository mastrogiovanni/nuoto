package main

import (
	"log"
	"net/url"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type Athlete struct {
	Posizione string   `json:"posizione"`
	Nazione   string   `json:"nazione"`
	Nome      string   `json:"nome"`
	Anno      string   `json:"anno"`
	Societa   string   `json:"societa"`
	Tempo     string   `json:"tempo"`
	Passaggi  []string `json:"passaggi,omitempty"`
}

func fetchPassaggi(idEvento, idGara, idAtleta, idTurno string) []string {
	formData := url.Values{}
	formData.Set("solr[id_evento]", idEvento)
	formData.Set("solr[id_gara]", idGara)
	formData.Set("solr[id_atleta]", idAtleta)
	formData.Set("solr[id_turno]", idTurno)

	response, err := QueryFedernuoto("https://www.federnuoto.it/index.php?option=com_solrconnect&view=passaggi&format=json", formData)
	if err != nil {
		return nil
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(response.Content))
	if err != nil {
		return nil
	}

	// Content is like: <span>Passaggi: 00:30.12 - 01:02.34 - ...</span>
	text := strings.TrimSpace(doc.Text())
	text = strings.TrimPrefix(text, "Passaggi:")
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}

	var passaggi []string
	for _, p := range strings.Split(text, "-") {
		t := strings.TrimSpace(p)
		if t != "" {
			passaggi = append(passaggi, t)
		}
	}
	return passaggi
}

func parseAthletes(htmlStr string) ([]Athlete, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlStr))
	if err != nil {
		return nil, err
	}

	var athletes []Athlete

	doc.Find("div.tournament").Each(func(_ int, s *goquery.Selection) {
		posizione := strings.TrimSpace(s.Find("p.positions").Text())
		nazione := strings.TrimSpace(s.Find("p.nazione").Text())
		nome := strings.TrimSpace(s.Find("p.name").Text())
		anno := strings.TrimSpace(s.Find("p.anno").Text())
		societa := strings.TrimSpace(s.Find("p.societa").Text())

		tempoP := s.Find("p.tempo")
		// Extract time text (first text node, before any child spans)
		tempo := strings.TrimSpace(tempoP.Contents().FilterFunction(func(_ int, n *goquery.Selection) bool {
			return n.Is("span") == false
		}).Text())

		var passaggi []string
		timeSpan := tempoP.Find("span.final_time_open")
		if timeSpan.Length() > 0 {
			idEvento, _ := timeSpan.Attr("data-id-evento")
			idGara, _ := timeSpan.Attr("data-id-gara")
			idAtleta, _ := timeSpan.Attr("data-id-atleta")
			idTurno, _ := timeSpan.Attr("data-id-turno")
			passaggi = fetchPassaggi(idEvento, idGara, idAtleta, idTurno)
		}

		a := Athlete{
			Posizione: posizione,
			Nazione:   nazione,
			Nome:      nome,
			Anno:      anno,
			Societa:   societa,
			Tempo:     tempo,
		}
		if len(passaggi) > 0 {
			a.Passaggi = passaggi
		}
		athletes = append(athletes, a)
	})

	return athletes, nil
}

func GetResults(idEvento, codiceGara, idCategoria, sesso string) ([]Athlete, error) {

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
	formData.Set("solr[codice_gara]", codiceGara)
	formData.Set("solr[id_categoria]", idCategoria)
	formData.Set("solr[sesso]", sesso)

	response, err := QueryFedernuoto("https://www.federnuoto.it/index.php?option=com_solrconnect&currentpage=1&view=dettagliorisultati&format=json", formData)
	if err != nil {
		log.Fatalf("error fetching results: %v", err)
	}

	athletes, err := parseAthletes(response.Content)
	if err != nil {
		log.Fatalf("error parsing HTML: %v", err)
	}

	return athletes, nil
}
