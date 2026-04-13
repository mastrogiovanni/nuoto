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
