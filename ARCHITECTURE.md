# Nuoto — Architecture

High-level map of how data flows from Italian swimming federations to the web app.

---

## Components

```
┌─────────────── DATA SOURCES ───────────────┐
│ FICR API          Federnuoto web + PDFs     │
│ Federnuoto master Federnuoto records pages  │
└────────────────────┬───────────────────────┘
                     │ Go scrapers (cmd/ficr, cmd/federnuoto, …)
                     ▼
┌─────────────── RAW (gitignored) ───────────┐
│ data_ficr/           data_federnuoto/       │
│ data_federnuoto_master/  data_federnuoto_records/ │
│ Layout: {year}/{comp_slug}/.terminated info.json {athlete}.json │
└────────────────────┬───────────────────────┘
                     │ cmd/aggregator (4 phases)
                     ▼
┌─────────────── AGGREGATED (source of truth) ─┐
│ aggregated/{year}/{comp}/info.json + athletes │
│ aggregated/_index/{key}.json  (~132K athletes)│
└────────────────────┬───────────────────────┘
                     │ backend loader → Redis (or aggregator -redis-addr)
                     ▼
┌─────────────── RUNTIME ────────────────────┐
│ Redis  ←  Go backend :8090  ←  nginx /api   │
│              ↑                                │
│ React SPA (frontend-v5) via Traefik HTTPS    │
│ Android/iOS WebView wrappers                 │
└──────────────────────────────────────────────┘
```

---

## Scrapers

| Binary | Output dir | Source |
|--------|------------|--------|
| `cmd/ficr` | `data_ficr/{year}/` | FICR REST API |
| `cmd/federnuoto` | `data_federnuoto/` | Federnuoto website |
| `cmd/federnuoto_master` | `data_federnuoto_master/` | Masters results |
| `cmd/federnuoto_records` | `data_federnuoto_records/` | National records pages |

Each competition directory must contain a **`.terminated`** sentinel when download is complete. The aggregator skips incomplete directories.

Shared Go utilities: `internal/httpclient`, `internal/worker`, `internal/strutil`.

PDF parsing for some Federnuoto flows lives in the separate **`pdf/`** Python subsystem (plugin architecture).

---

## Aggregator

`cmd/aggregator` merges all raw sources into `aggregated/`:

1. **Discover** — walk source trees, collect jobs per `(source, year)`
2. **Progress** — one progress bar per job
3. **Convert** — concurrent goroutines; per-competition `info.json` + athlete files
4. **Index flush** — write `aggregated/_index/{normalized_name}.json`

Collision rule: same slug from two sources → second written as `{source}_{slug}/`.

Full schemas and normalization: [AGGREGATOR.md](AGGREGATOR.md).

---

## Backend

`cmd/backend` — read-only HTTP API on port **8090**.

**Startup loading** (when enabled):

- Phase 1: load `aggregated/_index/` into Redis + build in-memory search cache (~30–90 s)
- Phase 2: background load of all result files

Note: `Load()` may be commented out in `main.go`; production often relies on the aggregator writing directly to Redis via `-redis-addr`.

**Redis keys:** see [DOCS.md](DOCS.md#redis-key-schema).

**Auth:** OAuth 2.0 (Google/Apple) → 7-day HS256 JWT. See [AUTH.md](AUTH.md).

**API contract:** [API.md](API.md).

---

## Frontends

Five React apps (`frontend/` … `frontend-v5/`). Only one runs at a time via Docker Compose **profile** (`v1`–`v5`).

| Profile | Directory | Status |
|---------|-----------|--------|
| v5 | `frontend-v5/` | **Current** — SwimRank: ranking, events, splits, favorites |
| v4 | `frontend-v4/` | Legacy SwimRank |
| v3 | `frontend-v3/` | Legacy design |
| v2 | `frontend-v2/` | TypeScript PWA |
| v1 | `frontend/` | Original |

nginx in each frontend container proxies `/api/*` → `backend:8090`.

---

## Orchestration

**Airflow** (`dags/scrapers_dag.py`) — daily at 02:00:

```
ficr ──────────────────────────┐
                               ├──► aggregate
federnuoto → master → records ─┘
```

Uses Docker image `nuoto-scrapers:latest` (`Dockerfile.scrapers`).

**Production stack:** `compose.nuoto.yml` — Traefik, Redis, backend, one frontend profile, Prometheus/Grafana.

**Monitoring:** [MONITORING.md](MONITORING.md).

---

## Auxiliary tools

| Tool | Purpose |
|------|---------|
| `cmd/query` | CLI search over aggregated data |
| `cmd/verify` | Validate scraped event completeness |
| `ranking.py` | Season PB rankings from raw Federnuoto data |
| `pdf/main.py` | Standalone PDF → CSV/JSON extractor |

---

## Missing from git

`internal/ficr/`, `internal/federnuoto/`, and `cmd/aggregator/` are required for a full pipeline build but may not be tracked. See [AGENTS.md](AGENTS.md#repository-gaps-important).
