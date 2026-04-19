package main

// AthleteIndex is loaded from aggregated/_index/*.json
type AthleteIndex struct {
	Name        string    `json:"name"`
	YearOfBirth string    `json:"year_of_birth"`
	Sex         string    `json:"sex"`
	Society     string    `json:"society"`
	Files       []CompRef `json:"files"`
}

// CompRef is a reference to a competition result file inside the aggregated tree.
type CompRef struct {
	Path        string `json:"path"`
	Competition string `json:"competition"`
	Date        string `json:"date"`
}

// AthleteResult is loaded from aggregated/{year}/{event}/*.json
type AthleteResult struct {
	Name        string   `json:"name"`
	YearOfBirth string   `json:"year_of_birth"`
	Sex         string   `json:"sex"`
	Society     string   `json:"society"`
	Nationality string   `json:"nationality"`
	Source      string   `json:"source"`
	Results     []Result `json:"results"`
}

// Result is a single race result within a competition.
type Result struct {
	Event    string  `json:"event"`
	Category string  `json:"category"`
	Time     string  `json:"time"`
	Position int     `json:"position"`
	Splits   []Split `json:"splits,omitempty"`
}

// Split is an intermediate split time.
type Split struct {
	Metres int    `json:"metres"`
	Time   string `json:"time"`
}

// EventInfo describes a competition event directory.
type EventInfo struct {
	Dir  string `json:"dir"`
	Name string `json:"name"`
	Date string `json:"date"`
}

// AthleteInfo is the summary returned in lists and search results.
type AthleteInfo struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	YearOfBirth string `json:"year_of_birth"`
	Sex         string `json:"sex"`
	Society     string `json:"society"`
}

// AthleteStats is the full stats payload returned for a single athlete.
type AthleteStats struct {
	Key         string       `json:"key"`
	Name        string       `json:"name"`
	YearOfBirth string       `json:"year_of_birth"`
	Sex         string       `json:"sex"`
	Society     string       `json:"society"`
	Records     []StatRecord `json:"records"`
}

// StatRecord groups one competition's results for an athlete.
type StatRecord struct {
	Competition string   `json:"competition"`
	Date        string   `json:"date"`
	Year        string   `json:"year"`
	EventDir    string   `json:"event_dir"`
	Results     []Result `json:"results"`
}

// NationalRecord is a single national record entry from federnuoto.
type NationalRecord struct {
	Specialita string `json:"specialita"`
	Atleta     string `json:"atleta"`
	Componenti string `json:"componenti,omitempty"`
	Tempo      string `json:"tempo"`
	Data       string `json:"data"`
	Luogo      string `json:"luogo"`
	Sezione    string `json:"sezione"`
}

// NationalRecordsPage is the full records page stored in Redis.
type NationalRecordsPage struct {
	Title    string             `json:"title"`
	URL      string             `json:"url"`
	Metadata NationalRecordMeta `json:"metadata"`
	Records  []NationalRecord   `json:"records"`
}

// NationalRecordMeta describes the scope of a records page.
type NationalRecordMeta struct {
	Vasca        string `json:"vasca"`
	Championship string `json:"championship"`
	Gender       string `json:"gender"`
}

// NationalRecordsIndexEntry is one item in the records index list.
type NationalRecordsIndexEntry struct {
	Vasca        string `json:"vasca"`
	Championship string `json:"championship"`
	Gender       string `json:"gender"`
}
