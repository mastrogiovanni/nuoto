---
name: nuoto-scrapers
description: >-
  Works on Nuoto Go scrapers for FICR and Federnuoto — raw JSON layout,
  .terminated sentinel, worker pools, and data directories. Use when fixing
  or extending cmd/ficr, cmd/federnuoto, cmd/federnuoto_master,
  cmd/federnuoto_records, cmd/enumatleti, cmd/gratleta, or cmd/verify.
---

# Nuoto scrapers

## Binaries

| Command | Output | Args |
|---------|--------|------|
| `ficr` | `data_ficr/{year}/` | `<year>` |
| `federnuoto` | `data_federnuoto/` | season/year |
| `federnuoto_master` | `data_federnuoto_master/` | season |
| `federnuoto_records` | `data_federnuoto_records/` | `-all` |
| `enumatleti` | athlete list | — |
| `gratleta` | personal bests | athlete id |
| `verify` | completeness check | event dir |

Core logic lives in `internal/ficr/` and `internal/federnuoto/` (**may be missing from git**).

## On-disk layout (both sources)

```
{source_dir}/{year}/{comp_slug}/
  .terminated          ← REQUIRED when download complete
  info.json            ← competition metadata
  {athlete_slug}.json  ← one file per athlete
```

Aggregator **silently skips** dirs without `.terminated`.

## Patterns

- Use `internal/worker` pool for concurrent downloads
- Use `internal/httpclient` for HTTP
- Event dir slugs: normalized lowercase with underscores
- Log progress; write atomically (write temp → rename)

## Source differences

**FICR:** REST API; `Nome`/`Cognome` fields; times as `M'SS.cc`; splits in `tempi[]` grouped by `(DescrGara, Batteria, Corsia)`.

**Federnuoto:** Web scrape + PDFs; name as `"COGNOME NOME"`; times as `MM:SS.cc`; uses `id_categoria` numeric codes; PDF parsing may delegate to `pdf/`.

## Build & run

```bash
go run ./cmd/ficr 2025
go run ./cmd/federnuoto 2024
./build-scraper-image.sh   # nuoto-scrapers:latest for Airflow
```

## Related docs

- [AGGREGATOR.md](../../AGGREGATOR.md) — what downstream expects
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — pipeline position
- `nuoto-pdf-extraction` skill — PDF side of Federnuoto
