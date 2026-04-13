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
