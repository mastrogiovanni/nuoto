# Nuoto — Agent Guide

Italian swimming competition data platform. Scrapers pull FICR and Federnuoto results, an aggregator normalizes JSON on disk, a Go backend loads Redis and serves a read-only REST API, and React frontends (v5 is current) consume it behind Traefik with OAuth.

**Read this file first.** Use the skills and docs below instead of re-exploring the repo from scratch.

---

## Quick routing

| Task | Start here |
|------|------------|
| Understand the system | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Backend API / Redis / handlers | [DOCS.md](DOCS.md), [API.md](API.md) — skill: `nuoto-backend-api` |
| Scrapers (FICR, Federnuoto) | `cmd/ficr`, `cmd/federnuoto`, … — skill: `nuoto-scrapers` |
| Aggregation / normalization | [AGGREGATOR.md](AGGREGATOR.md) — skill: `nuoto-aggregator` |
| Frontend (new UI work) | `frontend-v5/` — skill: `nuoto-frontend` |
| OAuth / JWT | [AUTH.md](AUTH.md) |
| Airflow / Docker / deploy | `dags/`, `compose.nuoto.yml` — skill: `nuoto-pipeline` |
| PDF result parsing | `pdf/` — skill: `nuoto-pdf-extraction` |
| Italian swimming terms | skill: `nuoto-swimming-domain` |
| Monitoring | [MONITORING.md](MONITORING.md) |

---

## Project skills (`.cursor/skills/`)

| Skill | Use when |
|-------|----------|
| `nuoto-overview` | First turn on the repo; need orientation or doc map |
| `nuoto-scrapers` | FICR/Federnuoto scrapers, raw JSON layout, `.terminated` sentinel |
| `nuoto-aggregator` | Normalization rules, athlete index keys, multi-source merge |
| `nuoto-backend-api` | Go HTTP handlers, Redis schema, loader, auth middleware |
| `nuoto-frontend` | React v5, API client, time display, OAuth flow |
| `nuoto-pipeline` | Airflow DAG, Docker images, compose profiles, backup |
| `nuoto-swimming-domain` | Strokes, categories, time formats, season vs year |
| `nuoto-pdf-extraction` | PDF plugins under `pdf/plugins/` |

Legacy Claude Code skills also exist at `pdf/.claude/skills/` (`pdf-structure`, `pdf-new-plugin`).

---

## Cursor rules (`.cursor/rules/`)

| Rule | Scope |
|------|-------|
| `nuoto-core.mdc` | Always — defaults, secrets, data dirs, canonical frontend |
| `go-scrapers-backend.mdc` | `**/*.go` |
| `frontend-v5.mdc` | `frontend-v5/**` |
| `data-pipeline.mdc` | DAGs, Dockerfiles, compose files |

---

## Canonical choices

- **Frontend:** `frontend-v5/` (SwimRank). Do not edit v1–v4 unless explicitly asked.
- **API spec:** [API.md](API.md) is the contract for frontends.
- **Data on disk:** `aggregated/` is the source of truth; raw dirs are gitignored.
- **Backend:** read-only at runtime; writes happen only via scrapers + aggregator.
- **Compose:** `compose.nuoto.yml` (not the stale `compose.backend.yml` referenced in DOCS.md).

---

## Repository gaps (important)

These packages are imported and built in Docker but may be **missing from git**:

- `internal/ficr/`
- `internal/federnuoto/`
- `cmd/aggregator/`

A fresh clone will not build scrapers or the aggregator image until these are restored. Check locally before assuming compile errors are your fault.

---

## Do not commit

- Scraped/aggregated data (`data_*`, `aggregated/`)
- `.env`, OAuth secrets, Apple `.p8` keys
- `node_modules/`, Xcode user state, `.DS_Store`

---

## Time and naming conventions

- Race times: apostrophe = minutes — `"1'02.34"` or `"25.34"` (seconds only). Aggregated output adds a closing `"`.
- Athlete **key:** lowercase `[a-z0-9_]`, from `strutil.Normalize("cognome nome")` — e.g. `rossi_mario`.
- Event **dir:** competition directory slug under `aggregated/{year}/`.
- Names in aggregated JSON: `"Nome Cognome"` display order.

---

## Local dev shortcuts

```bash
# Backend (needs Redis + pre-loaded data or aggregator run)
go run ./cmd/backend

# Query aggregated data from CLI
go run ./cmd/query -name "rossi"

# Frontend v5 dev server
cd frontend-v5 && npm run dev

# Production stack (pick one frontend profile)
docker compose -f compose.nuoto.yml --profile v5 up -d --build

# Scraper image
./build-scraper-image.sh
```

---

## Documentation index

| File | Contents |
|------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | End-to-end pipeline, components, data flow |
| [DOCS.md](DOCS.md) | Backend service, Redis loading, data formats |
| [API.md](API.md) | REST API reference + TypeScript types |
| [AGGREGATOR.md](AGGREGATOR.md) | Schemas, normalization, source conversions |
| [AUTH.md](AUTH.md) | Google/Apple OAuth, JWT, env vars |
| [MONITORING.md](MONITORING.md) | Traefik, Prometheus, Grafana |
| [pdf/README.md](pdf/README.md) | PDF extractor CLI |
| [pdf/PLUGINS.md](pdf/PLUGINS.md) | PDF plugin developer guide |
