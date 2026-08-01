---
name: nuoto-overview
description: >-
  Orients agents on the Nuoto Italian swimming platform — components, doc map,
  canonical frontend, and repo gaps. Use at the start of any Nuoto task or when
  unsure which doc, skill, or directory to open.
---

# Nuoto overview

## What this project is

Scrape FICR + Federnuoto → aggregate to unified JSON → load Redis → serve REST API → React SwimRank UI.

## Read order

1. [AGENTS.md](../../AGENTS.md) — index (skills, rules, shortcuts)
2. [ARCHITECTURE.md](../../ARCHITECTURE.md) — pipeline diagram
3. Task-specific doc (see routing table in AGENTS.md)

## Skill routing

| User intent | Skill |
|-------------|-------|
| Scraper bug / new source | `nuoto-scrapers` |
| Normalization / index keys | `nuoto-aggregator` |
| API / Redis / Go handlers | `nuoto-backend-api` |
| UI / React | `nuoto-frontend` |
| Airflow / Docker / deploy | `nuoto-pipeline` |
| Strokes, categories, times | `nuoto-swimming-domain` |
| PDF parsing | `nuoto-pdf-extraction` |

## Hard defaults

- Edit `frontend-v5/` for UI work
- `aggregated/` is source of truth on disk
- Backend does not write competition data
- Missing packages: `internal/ficr`, `internal/federnuoto`, `cmd/aggregator`

## Key paths

```
cmd/backend/          HTTP API
cmd/ficr/             FICR scraper
cmd/federnuoto/       Federnuoto scraper
cmd/query/            CLI over aggregated data
dags/scrapers_dag.py  Airflow schedule
frontend-v5/          Current React app
pdf/                  PDF extractor (Python)
internal/strutil/     Name → index key
```
