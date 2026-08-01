---
name: nuoto-aggregator
description: >-
  Guides Nuoto aggregation — unified JSON schemas, normalization rules,
  athlete index keys, and multi-source merge. Use when working on cmd/aggregator,
  aggregated/ layout, strutil.Normalize, or data format mismatches between
  FICR and Federnuoto.
---

# Nuoto aggregator

**Full spec:** [AGGREGATOR.md](../../AGGREGATOR.md) — read it for schemas and examples.

## Pipeline (4 phases)

1. Discover — walk `data_ficr/`, `data_federnuoto/`, …
2. Progress bars — one per `(source, year)` job
3. Concurrent convert — per competition: `info.json` + athlete files + index contributions
4. Index flush — `aggregated/_index/{key}.json`

## Output layout

```
aggregated/{year}/{comp_slug}/info.json      → AggCompetition
aggregated/{year}/{comp_slug}/{athlete}.json → AggAthlete
aggregated/_index/{key}.json                 → AthleteIndex
```

Slug collision: second source → `{source}_{slug}/`.

## Normalization (must match exactly)

| Field | Rule |
|-------|------|
| Event | `[distance]m [stroke]` lowercase Italian — e.g. `100m stile libero` |
| Time | `M'SS.cc"` — colon input → apostrophe; strip leading zero minutes |
| Category | trim + lowercase |
| Society | Title Case per word |
| Sex | lowercase `m`/`f` |
| Index key | `strutil.Normalize("cognome nome")` → `[a-z0-9_]` |

### Stroke aliases (→ canonical Italian)

`freestyle` → `stile libero`, `backstroke` → `dorso`, `breaststroke` → `rana`, `butterfly` → `farfalla`, `medley` → `misti`

## Source-specific notes

- **Federnuoto:** split name at last space for display name; no splits in output; empty category
- **FICR:** group `tempi[]` by race for splits; last row = final time

## Index key implementation

```go
// internal/strutil/normalize.go
strutil.Normalize("rossi mario") // → "rossi_mario"
```

Accents transliterated; non-alphanumeric → `_`; collapsed/trimmed.

## CLI flags (typical)

```
-aggregator
  -data data_ficr/
  -data-federnuoto data_federnuoto/
  -data-federnuoto-master ...
  -data-federnuoto-records ...
  -out aggregated/
  -redis-addr redis:6379   # optional direct Redis load
```

## When debugging format issues

1. Compare raw file in `data_*` vs aggregated output
2. Check normalization function for that field in aggregator code
3. Verify `.terminated` exists (otherwise dir was skipped entirely)
