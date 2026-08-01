---
name: nuoto-swimming-domain
description: >-
  Italian swimming domain knowledge for Nuoto — strokes, categories, pool
  lengths, time formats, season vs calendar year, and Federnuoto category IDs.
  Use when parsing events, normalizing names, displaying results, or explaining
  Italian competition terminology.
---

# Nuoto swimming domain (Italy)

## Strokes (canonical Italian)

| Italian | English | Aliases in raw data |
|---------|---------|---------------------|
| stile libero | freestyle | free style, freestyle |
| dorso | backstroke | backstroke |
| rana | breaststroke | breastroke (typo) |
| farfalla | butterfly | buttefly (typo) |
| misti | medley | midley (typo) |

Normalized event format: `{distance}m {stroke}` — e.g. `400m stile libero`, `4x50m misti`.

## Categories (examples)

Lowercase in aggregated output:

- `esordienti a maschi` / `esordienti a femmine`
- `giovanissimi maschi`, `ragazzi`, `cadetti`, `juniores`, `seniores`
- `unica femmine`, `unica maschi`

Federnuoto raw data uses numeric `id_categoria` codes — not human labels. Aggregator leaves `category` empty for Federnuoto.

## Pool lengths

- `25m` — vasca corta (short course)
- `50m` — vasca lunga (long course)

Stored in `AggCompetition.pool`.

## Time formats

| Context | Format | Example |
|---------|--------|---------|
| FICR raw | `M'SS.cc` | `4'45.89` |
| Federnuoto raw | `MM:SS.cc` | `01:52.50` |
| Aggregated/API | `M'SS.cc"` | `1'52.50"` |
| Sub-minute | `SS.cc"` | `26.61"` |

Apostrophe (`'`) = minute separator. Closing `"` added by aggregator.

## Name order

| Source | Raw | Aggregated display |
|--------|-----|-------------------|
| FICR | `Nome` + `Cognome` | `"Nome Cognome"` |
| Federnuoto | `"COGNOME NOME"` | split at last space → `"Nome Cognome"` |
| Index key | — | `strutil.Normalize("cognome nome")` |

## Season vs calendar year

- **FICR scraper** takes a calendar `<year>` argument
- **Federnuoto** uses swimming season (often previous calendar year for current season)
- Airflow: ficr = `CURRENT_YEAR`, federnuoto chain = `PAST_YEAR`

## Records API

National records scraped to `data_federnuoto_records/`:

```
GET /api/records
GET /api/records/{vasca}/{championship}/{gender}
```

`vasca`: `25` or `50`; `gender`: `M` or `F`.

## Status codes (PDF subsystem)

`OK`, `NP` (no-show), `AB` (abandoned), `RIT`/`DNS`/`DNF`.

## ranking.py

Standalone Python CLI for season PB rankings from **raw** Federnuoto data — separate from API ranking in v5. See [DOCS.md](../../DOCS.md).
