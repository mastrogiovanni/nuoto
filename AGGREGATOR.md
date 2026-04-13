# Aggregator

`cmd/aggregator/main.go` reads raw competition data from two scraped sources
(FICR and Federnuoto) and writes a unified, normalised representation under
`aggregated/`.

---

## Sources

| Flag | Default directory | Source tag |
|------|-------------------|------------|
| `-data` | `data_ficr/` | `ficr` |
| `-data-federnuoto` | `data_federnuoto/` | `federnuoto` |
| `-out` | `aggregated/` | — |

Both sources share the same on-disk layout:

```
<source_dir>/
  <year>/
    <competition_slug>/
      .terminated          ← sentinel: download is complete
      info.json            ← competition metadata
      <athlete_slug>.json  ← one file per athlete
```

A competition directory that lacks `.terminated` is silently skipped.

---

## Output layout

```
aggregated/
  <year>/
    <competition_slug>/
      info.json            ← AggCompetition
      <athlete_slug>.json  ← AggAthlete
  _index/
    <normalised_name>.json ← AthleteIndex (cross-competition)
```

If two sources produce a competition with the same slug in the same year, the
second one is written to `<source>_<slug>/` to avoid overwriting the first.

---

## Processing pipeline

The aggregator runs in four sequential phases:

**Phase 1 — discovery.**  
Both source trees are walked. Every `<year>/<comp>` directory is collected into
a list of jobs, one job per `(source, year)` pair.

**Phase 2 — progress initialisation.**  
One terminal progress bar is reserved per job (one per source/year pair).

**Phase 3 — concurrent conversion.**  
Each job runs in its own goroutine. Within a job, competitions are processed
one by one. For each competition:

1. `info.json` is read and converted to `AggCompetition` (or derived from the
   directory name if absent).
2. Every athlete file is read, converted to `AggAthlete`, and written to the
   output directory.
3. Each written athlete produces an `indexContrib` that is merged into the
   global athlete index under a lock.

**Phase 4 — index flush.**  
`aggregated/_index/<normalised_name>.json` is written for every unique athlete
seen across all competitions.

---

## JSON schemas

### `AggCompetition` — `aggregated/<year>/<comp>/info.json`

```json
{
  "name":     "Trofeo Torre del Barbarossa",
  "year":     2014,
  "dates":    ["1 marzo 2014"],
  "pool":     "25m",
  "location": "Bergamo",
  "source":   "ficr",
  "id":       "1234"
}
```

| Field | Notes |
|-------|-------|
| `name` | Display name as-is from the source |
| `year` | Integer year |
| `dates` | Free-text date strings from the source; may be empty |
| `pool` | Pool length, e.g. `"25m"` or `"50m"`; omitted when unknown |
| `location` | City/venue; for FICR, stripped from `"CITY, Dal …"` |
| `source` | `"ficr"` or `"federnuoto"` |
| `id` | Source-internal competition ID |

### `AggAthlete` — `aggregated/<year>/<comp>/<athlete>.json`

```json
{
  "name":          "Riccardo Alborghetti",
  "year_of_birth": "2001",
  "sex":           "m",
  "society":       "Gam Team Nuoto",
  "nationality":   "ITA",
  "source":        "ficr",
  "results": [
    {
      "event":    "400m stile libero",
      "category": "esordienti a maschi",
      "time":     "4'45.89\"",
      "position": 3,
      "splits": [
        { "metres": 100, "time": "1'07.22\"" },
        { "metres": 400, "time": "4'45.89\"" }
      ]
    }
  ]
}
```

| Field | Notes |
|-------|-------|
| `name` | `"Nome Cognome"` order |
| `year_of_birth` | String year |
| `sex` | Lowercase: `"m"` or `"f"` |
| `society` | Title Case (see normalisation below) |
| `nationality` | Passed through as-is from source |
| `source` | `"ficr"` or `"federnuoto"` |
| `results[].event` | Normalised event string (see below) |
| `results[].category` | Lowercase category string; omitted when empty |
| `results[].time` | Normalised time string (see below) |
| `results[].position` | Finish position; omitted when 0 |
| `results[].splits` | Intermediate times; omitted when unavailable (federnuoto never provides them) |

### `AthleteIndex` — `aggregated/_index/<key>.json`

```json
{
  "name":          "Riccardo Alborghetti",
  "year_of_birth": "2001",
  "sex":           "m",
  "society":       "Gam Team Nuoto",
  "files": [
    {
      "path":        "2014/1_3_trofeo_torre_del_barbarossa/alborghetti_riccardo.json",
      "competition": "Trofeo Torre del Barbarossa",
      "date":        "1 marzo 2014"
    }
  ]
}
```

The index key (filename) is produced by `strutil.Normalize` applied to the
athlete's name in `"Cognome Nome"` order: accented characters are
transliterated to ASCII, non-alphanumeric characters become underscores
(leading/trailing underscores are stripped).

---

## Source-specific conversions

### Federnuoto

Raw athlete files store the name in `"COGNOME NOME"` order with mixed case.
`fedDisplayName` splits at the **last** space to reconstruct `"Nome Cognome"`,
preserving multi-word surnames.

The `id_categoria` field contains a numeric code (`"37"`, `"55"`, …) — it is
not a human-readable category label. The aggregator does not expose it; the
`category` field in `AggResult` is left empty for federnuoto results.

Sex is taken from the first `tempi` entry's `sesso` field.

Time strings use the colon format `MM:SS.cc` (e.g. `"01:52.50"`).

### FICR

Raw athlete files use separate `Nome` / `Cognome` fields (Cognome is all-caps).
The aggregated name is `Nome + " " + Cognome` without reordering.

Each FICR athlete file can contain multiple `tempi` rows for the same race,
one per intermediate distance (split). Rows belonging to the same race are
identified by matching `(DescrGara, Batteria, Corsia)`. The last row in a
group (highest `Metri` value) carries the final time; all rows become `splits`.
If a group has only one row, `splits` is omitted.

Time strings use the apostrophe format `M'SS.cc` (e.g. `"4'45.89"`).

---

## Normalisation rules

All normalisation functions are pure and applied at conversion time, before
writing any output file.

### Event names — `normalizeEvent`

**Target format:** `[distance]m [stroke]` in lowercase.

Steps applied in order:

1. The string is trimmed of surrounding whitespace.
2. A regex extracts the numeric distance prefix (including relay notation like
   `4x50`) and the stroke suffix. A trailing `m` or `mt` on the distance is
   accepted but not required.
3. Both parts are lower-cased.
4. The stroke is matched against an alias table that maps English names and
   common typos to their canonical Italian form:

   | Input (case-insensitive) | Canonical |
   |--------------------------|-----------|
   | `freestyle`, `free style` | `stile libero` |
   | `backstroke` | `dorso` |
   | `breaststroke`, `breastroke` | `rana` |
   | `butterfly`, `buttefly` | `farfalla` |
   | `medley`, `midley` | `misti` |

5. If the stroke begins with a known Italian core name followed by a space
   (e.g. `"stile libero freestyle"`, `"dorso backstroke"`), the trailing
   annotation is dropped.
6. The result is assembled as `distm stroke`.

Examples:

| Raw input | Normalised output |
|-----------|-------------------|
| `"100 Stile Libero"` | `"100m stile libero"` |
| `"50m MISTI"` | `"50m misti"` |
| `"100m Backstroke"` | `"100m dorso"` |
| `"200m Butterfly"` | `"200m farfalla"` |
| `"400m Medley"` | `"400m misti"` |
| `"4X50m Stile Libero"` | `"4x50m stile libero"` |
| `"100m Stile Libero Freestyle"` | `"100m stile libero"` |
| `"200m Dorso Backstroke"` | `"200m dorso"` |

Strings that do not match the `[distance] [stroke]` pattern are lower-cased
as-is (e.g. special lifesaving events).

### Times — `normalizeTime`

**Target format:** `M'SS.cc"` — minutes (no leading zero), apostrophe,
seconds and decimals, closing double-quote. Sub-minute times have no minute
part: `SS.cc"`.

Input formats handled:

| Input | Output | Notes |
|-------|--------|-------|
| `"4'45.89"` | `"4'45.89\""` | FICR apostrophe — closing quote added |
| `"01:52.50"` | `"1'52.50\""` | Federnuoto colon — colon → apostrophe, leading zero stripped |
| `"00:26.61"` | `"26.61\""` | Zero minutes dropped |
| `"33.03"` | `"33.03\""` | Plain seconds — closing quote added |
| `""` | `""` | Empty preserved |

The function is idempotent: strings already ending in `"` are returned
unchanged.

### Category — `normalizeCategory`

Trimmed and fully lower-cased. Examples:

| Raw | Normalised |
|-----|------------|
| `"ESORDIENTI A MASCHI"` | `"esordienti a maschi"` |
| `"Unica Femmine"` | `"unica femmine"` |
| `" GIOVANISSIMI MASCHI"` | `"giovanissimi maschi"` |

### Society — `normalizeSociety`

Converted to **Title Case**: the first character of each whitespace-separated
word is upper-cased, the rest are lower-cased. This unifies all-caps FICR
values with the mixed-case federnuoto values.

Examples:

| Raw | Normalised |
|-----|------------|
| `"GAM TEAM NUOTO"` | `"Gam Team Nuoto"` |
| `"A.S.D. GYMNASIUM PORDENONE"` | `"A.s.d. Gymnasium Pordenone"` |
| `"A.s.d. Dnu Sport"` | `"A.s.d. Dnu Sport"` |
| `"055 Il Policentro ssd"` | `"055 Il Policentro Ssd"` |

### Sex

Lower-cased as-is: `"M"` → `"m"`, `"F"` → `"f"`.

### Athlete index key — `strutil.Normalize`

Applied to the athlete's name written in `"Cognome Nome"` order. Steps:

1. Accented / Latin-extended characters are transliterated to their ASCII base
   (`à→a`, `è→e`, `ì→i`, `ò→o`, `ù→u`, `ç→c`, `ñ→n`, `ý/ÿ→y`).
2. Every character that is not `[a-z0-9]` is replaced with `_`.
3. Runs of `_` are collapsed to a single `_`; leading and trailing `_` are
   stripped.

This key is used as the filename inside `aggregated/_index/`.
