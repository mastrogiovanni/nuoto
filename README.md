# nuoto

Tools for scraping and querying Italian swimming competition data from the [FICR](https://www.ficr.it) API.

## Structure

```
nuoto/
├── main.go          # Scraper — fetches data from the FICR API
├── cmd/query/       # CLI query tool
│   └── main.go
└── data/
    ├── 2025/
    │   └── <event_dir>/
    │       ├── info.json
    │       └── <cognome_nome>.json
    └── 2026/
        └── <event_dir>/
            ├── info.json
            └── <cognome_nome>.json
```

## Scraper

Fetches all events for a given year and saves each athlete's results as JSON files under `data/`.

### Build & run

```bash
go build -o nuoto .
./nuoto
```

The year is hardcoded to `2026` in `main.go`. Change the `year` variable in `main()` to scrape a different year.

### Output

Each event gets a directory named `<showID>_<normalized_description>/` containing:

- `info.json` — event metadata (date, location, pool length, etc.)
- One JSON file per athlete, named `<cognome_nome>.json`

**Athlete file format:**

```json
{
  "atleta": {
    "Nome": "Gianmarco",
    "Cognome": "PICA",
    "Codice": "1375399",
    "Naz": "ITA",
    "Sex": "M",
    "Anno": 2012,
    "Soc": "CLUB AQUATICO PESCARA SSD"
  },
  "tempi": [
    {
      "DescrGara": "100m Stile Libero",
      "Metri": 50,
      "Tempo": "36.10",
      ...
    },
    {
      "DescrGara": "100m Stile Libero",
      "Metri": 100,
      "Tempo": "1'15.63",
      ...
    }
  ]
}
```

The `tempi` array contains one entry per split. For races longer than 50m, consecutive entries sharing the same `DescrGara` represent intermediate splits (e.g. 50m and 100m entries for a 100m race).

---

## Query CLI

Interactive tool to search athletes and inspect their aggregated results across all events.

### Build

```bash
go build -o query ./cmd/query/
```

### Commands

#### `search <name>`

Lists all athletes whose name (first or last) contains the given string. Case-insensitive. Returns a JSON array.

```bash
./query search rachele
./query search "agliardi"
```

**Output:**

```json
[
  {
    "name": "RACHELE AGLIARDI",
    "club": "ISOCELL OROBICA",
    "birth_year": 2016,
    "sex": "F",
    "events": [
      "4 \"LAUS\" Christmas Cup",
      "9' TROFEO SPRINT MILLENNIUM",
      "XXXIX Trofeo di nuoto Città di Verolanuova",
      "3°Man. Prov. Esordienti B",
      "4°Man. Prov. Esordienti B"
    ]
  }
]
```

#### `results <name>`

Returns all race results for athletes matching the name, aggregated across all events. Splits are grouped: when a race has intermediate measurements (e.g. a 100m race recorded at 50m and 100m), the `time` field is a list of `{metres, time}` objects instead of a plain string.

```bash
./query results "agliardi rachele"
./query results "rachele agliardi"
```

**Output:**

```json
[
  {
    "event": "9' TROFEO SPRINT MILLENNIUM",
    "date": "18/01/2026",
    "style": "50m Rana",
    "category": "Esordienti Femmine",
    "time": "59.56"
  },
  {
    "event": "9' TROFEO SPRINT MILLENNIUM",
    "date": "18/01/2026",
    "style": "100m Stile Libero",
    "category": "Esordienti Femmine",
    "time": [
      { "metres": 50, "time": "52.90" },
      { "metres": 100, "time": "1'53.77" }
    ]
  }
]
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-data <dir>` | `data` | Path to the data directory |

```bash
./query -data /path/to/data results "rossi mario"
```
