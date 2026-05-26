# Nuoto Backend — Service Documentation

## Overview

The backend is a Go HTTP service that indexes Italian swimming competition data into Redis and exposes a read-only REST API. On startup it loads the `aggregated/` directory — which contains results scraped from Federnuoto and FICR — into Redis, then serves the API.

The service is intentionally read-only. All write operations (scraping, aggregation) happen through separate pipeline tooling and produce the files in `aggregated/`.

---

## Architecture

```
aggregated/               ← source of truth on disk
  _index/                 ← one JSON file per athlete (132 K files, ~944 MB)
  2014/ … 2026/           ← one directory per year
    <event_dir>/          ← one directory per competition (~2 400 dirs/year)
      <athlete>.json      ← one result file per athlete per competition
```

### Loading sequence

1. **Phase 1 — Index (synchronous, ~30–90 s)**
   All files in `aggregated/_index/` are read in parallel and written to Redis.
   - Per-athlete data, the lexicographic sorted set used for pagination, the year set,
     per-year event hashes, and per-event athlete sets are all populated here.
   - An in-memory search slice (`[]SearchEntry`) is built from the sorted set.
   - The HTTP server starts and accepts requests as soon as phase 1 completes.

2. **Phase 2 — Result files (background)**
   Every competition result file (`aggregated/{year}/{event}/{athlete}.json`) is
   streamed into Redis in parallel. Until a result file is present in Redis the
   `/api/athletes/{id}/stats` endpoint transparently reads the file from disk, so
   stats are always available — they are just slightly slower before phase 2 finishes.

### Redis key schema

| Key pattern | Type | Content |
|---|---|---|
| `athlete:{key}` | STRING | Full index JSON (`AthleteIndex`) |
| `athletes:names` | SORTED SET | Members `UPPERCASE_NAME\x00{key}`, all at score 0 (lex order) |
| `years` | SET | Available year strings, e.g. `"2024"` |
| `year:{year}:events` | HASH | `event_dir → EventInfo JSON` |
| `event:{year}:{event_dir}:athletes` | SET | Index keys of athletes present in that event |
| `results:{year}:{event_dir}:{athlete_key}` | STRING | Competition result JSON (`AthleteResult`) |

The `{key}` used throughout is the basename of the athlete's index file without the
`.json` extension, e.g. `rossi_mario`. It is distinct from the per-competition
filename: `rossi_mario` may appear in `aggregated/_index/rossi_mario.json` while
the corresponding competition file might be `aggregated/2024/some_event/mario_rossi.json`.
The athlete index's `files[].path` always carries the correct relative path to each
competition file.

---

## Running with Docker Compose

```bash
# Start Redis and the backend
docker compose -f compose.backend.yml up --build

# Follow logs
docker compose -f compose.backend.yml logs -f backend
```

The `aggregated/` directory is mounted read-only into the container at
`/data/aggregated`. Redis data is persisted in a named volume `redis-data`.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_ADDR` | `localhost:6379` | Redis address |
| `AGGREGATED_DIR` | `aggregated` | Path to the aggregated data directory |
| `PORT` | `8090` | HTTP port the server listens on |

### Resource requirements

The index phase loads roughly 132 K athlete records into Redis. Each record is a few
hundred bytes of JSON plus Redis overhead: expect **~500 MB–1 GB** of Redis memory
after phase 1.

Phase 2 loads all competition result files (tens of millions of records across 30 GB
of source files). Full Redis memory consumption depends on available RAM; the service
works correctly even if phase 2 is interrupted because it always falls back to disk.

---

## Running locally (without Docker)

```bash
# Start a local Redis
redis-server &

# Build and run
go build -o backend ./cmd/backend
AGGREGATED_DIR=./aggregated ./backend
```

---

## Project layout (backend-relevant files)

```
cmd/backend/
  main.go       — server setup, routing, CORS middleware
  loader.go     — Redis loading (index + results)
  handlers.go   — HTTP request handlers
  models.go     — shared Go structs

Dockerfile.backend   — multi-stage build (golang:1.24-alpine → alpine:3.21)
compose.backend.yml  — Docker Compose for Redis + backend
```

---

## Data sources and formats

### Athlete index (`aggregated/_index/{key}.json`)

```json
{
  "name": "MARIO ROSSI",
  "year_of_birth": "1990",
  "sex": "M",
  "society": "NUOTO CLUB ROMA ASD",
  "files": [
    {
      "path": "2024/10061_secondo_trofeo_sogisport/rossi_mario.json",
      "competition": "2° Trofeo Sogisport",
      "date": "15 Marzo 2024"
    }
  ]
}
```

`sex` is `"M"` or `"F"`. `date` format varies by data source: Federnuoto uses
`"DD Mese YYYY"` (Italian month name), FICR uses `"DD/MM/YYYY"`.

### Competition result file (`aggregated/{year}/{event_dir}/{athlete_key}.json`)

```json
{
  "name": "Mario ROSSI",
  "year_of_birth": "1990",
  "sex": "M",
  "society": "NUOTO CLUB ROMA ASD",
  "nationality": "ITA",
  "source": "ficr",
  "results": [
    {
      "event": "50m Stile Libero",
      "category": "Assoluti Maschi",
      "time": "25.34",
      "position": 1,
      "splits": [
        { "metres": 50, "time": "25.34" }
      ]
    }
  ]
}
```

`source` is `"ficr"` or `"federnuoto"`. `splits` is omitted when no intermediate
times were recorded. `time` format uses apostrophe as minute separator:
`"1'02.34"` means 1 minute 2.34 seconds.

---

## `ranking.py` — Season Ranking CLI

A standalone Python script that scans the raw `data_federnuoto/` directory for a given
season and produces a ranking of swimmers ordered by their personal best time in a
specific event.

### Requirements

Python 3.10+. No external dependencies; only the standard library is used.

### Usage

```
python3 ranking.py --sex <M|F> --stroke <stile> --distance <dist> [options]
```

### Options

| Flag | Short | Required | Description |
|---|---|---|---|
| `--sex` | `-s` | yes | Swimmer sex: `M` or `F` |
| `--stroke` | | yes | Stroke name (see aliases below) |
| `--distance` | `-d` | yes | Distance in metres: `50`, `100`, `200`, `400`, `800`, `1500` |
| `--categoria` | `-c` | no | Filter by category id (e.g. `330`). Omit to include all categories |
| `--region` | `-r` | no | Filter by competition location: region name (e.g. `lazio`) or province code (e.g. `RM`) |
| `--birth` | `-b` | no | Filter by birth year(s), comma-separated (e.g. `2011,2012`) |
| `--pool` | `-p` | no | Filter by pool length: `25` or `50` |
| `--season` | | no | Season folder (default: `2025`, meaning the 2025-2026 season) |
| `--top` | `-n` | no | Limit output to the top N results |

### Stroke aliases

The `--stroke` argument is case-insensitive and accepts any of the following names:

| Input | Canonical name |
|---|---|
| `rana`, `breaststroke` | Rana |
| `farfalla`, `delfino`, `butterfly` | Farfalla |
| `dorso`, `backstroke` | Dorso |
| `stile libero`, `stile`, `sl`, `freestyle` | Stile Libero |
| `misti`, `mx`, `im`, `medley` | Misti |

### Output

```
Ranking: 100 Rana | M | Stagione 2025-2026
#    Atleta                         Società                        Tempo      Data         Gara
--------------------------------------------------------------------------------------------------------------
1    Mancini Gabriele               G.S. Marina Militare           56.89      2025-12-11   Campionato Italiano Assoluto Open - Frecciarossa
2    MARTINENGHI NICOLO'            Circolo Canottieri Aniene      57.06      2025-12-20   Campionato Nazionale a Squadre - "Coppa Brema" 2025
...
```

Each row shows the swimmer's name, society, personal-best time in the season, the date
it was achieved, and the name of the competition where it was set.

### Season folders

The `data_federnuoto/` directory is organised by season start year, not calendar year.
The folder `2025` contains competitions held between September 2025 and August 2026.

| Folder | Season |
|---|---|
| `2024` | 2024-2025 |
| `2025` | 2025-2026 (current) |

### Region filter

`--region` restricts results to competitions held in a given geographic area.
It accepts either a **region name** (case-insensitive) or a **two-letter province code**:

```bash
--region lazio        # all provinces in Lazio (FR, LT, RI, RM, VT)
--region RM           # only the province of Roma
```

| Region | Provinces |
|---|---|
| Abruzzo | AQ CH PE TE |
| Basilicata | MT PZ |
| Calabria | CS CZ KR RC VV |
| Campania | AV BN CE NA SA |
| Emilia Romagna | BO FC FE MO PC PR RA RE RN |
| Friuli Venezia Giulia | GO PN TS UD |
| Lazio | FR LT RI RM VT |
| Liguria | GE IM SP SV |
| Lombardia | BG BS CO CR LC LO MB MI MN PV SO VA |
| Marche | AN AP FM MC PU |
| Molise | CB IS |
| Piemonte | AL AT BI CN NO TO VB VC |
| Puglia | BA BAT BR FG LE TA |
| Sardegna | CA NU OR SS SU |
| Sicilia | AG CL CT EN ME PA RG SR TP |
| Toscana | AR FI GR LI LU MS PI PO PT SI |
| Trentino Alto Adige | BZ TN |
| Umbria | PG TR |
| Valle d'Aosta | AO |
| Veneto | BL PD RO TV VE VI VR |

The filter applies to the **competition's location**, not the athlete's club registration.
A swimmer from a Lombardia club who competes in Lazio will appear in `--region lazio`
results and will not appear in `--region lombardia` results.

### Examples

```bash
# Top 20 men's 100m breaststroke, current season
python3 ranking.py --sex M --stroke rana --distance 100 --top 20

# Women's 50m butterfly (using the "delfino" alias)
python3 ranking.py -s F --stroke delfino -d 50

# Men's 200m freestyle, filtered to category 330
python3 ranking.py --sex M --stroke "stile libero" -d 200 --categoria 330

# Women's 200m individual medley from the previous season
python3 ranking.py -s F --stroke misti -d 200 --season 2024

# Top 10 women's 100m backstroke
python3 ranking.py -s F --stroke dorso -d 100 -n 10

# Men's 100m breaststroke, competitions held in Lazio
python3 ranking.py --sex M --stroke rana -d 100 --region lazio

# Women's 50m butterfly, competitions held in the province of Roma only
python3 ranking.py -s F --stroke farfalla -d 50 --region RM

# Men's 100m breaststroke, athletes born in 2011 or 2012
python3 ranking.py --sex M --stroke rana -d 100 --birth 2011,2012

# Women's 50m butterfly in Lazio, athletes born in 2010
python3 ranking.py -s F --stroke farfalla -d 50 --region lazio --birth 2010

# Men's 100m breaststroke, 50m pool only
python3 ranking.py --sex M --stroke rana -d 100 --pool 50

# Women's 50m butterfly in Lazio, born 2010, 25m pool
python3 ranking.py -s F --stroke farfalla -d 50 --region lazio --birth 2010 --pool 25
```

### Categories (`id_categoria`)

Each result record carries an `id_categoria` field that identifies the age-group
category under which the swim was competed. Every category id is sex-specific — the
same age group has a different id for males and females.

The values observed in the dataset and their meanings:

| id | Sex | Birth years (2025-26 season) | FIN age group |
|---|---|---|---|
| `44` | F | 2016 – 2017 | Esordienti B |
| `45` | M | 2015 – 2016 | Esordienti B |
| `40` | F | 2014 – 2015 | Esordienti A |
| `41` | M | 2013 – 2014 | Esordienti A |
| `53` | F | 2012 – 2013 | Ragazzi |
| `55` | M | 2010 – 2012 | Ragazzi |
| `48` | F | 2010 – 2011 | Juniores |
| `50` | M | 2008 – 2009 | Juniores |
| `34` | F | 2008 – 2009 | Cadetti |
| `37` | M | 2006 – 2007 | Cadetti |
| `58` | F | ≤ 2007 | Assoluti |
| `60` | M | ≤ 2005 | Assoluti |
| `330` | M/F | all | Open (mixed / no age restriction) |

**Notes:**

- The birth-year boundaries shift by one each season (an athlete born in 2012 is a
  Ragazzi in 2025-2026 and a Juniores in 2026-2027).
- `330` is the catch-all value used at open/assoluti competitions that do not subdivide
  results by age group. It covers the widest range of athletes and is the most common
  value in the dataset.
- When querying `ranking.py` without `--categoria`, all categories are included in the
  ranking. Use `--categoria 330` to restrict to results recorded under the open category,
  or a specific id to restrict to one age group.

### How it works

1. The script iterates over every competition directory inside `data_federnuoto/<season>/`.
2. For each directory it reads `info.json` (competition name and dates) and then every
   athlete JSON file.
3. A result is included when `stile == "<distance> <stroke>"`, `sesso == <sex>`, and —
   if `--categoria` is given — `id_categoria == <categoria>`.
4. Only each swimmer's **best time** across all competitions is kept.
5. Swimmers are ranked in ascending order of time (fastest first).
