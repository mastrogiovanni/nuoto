# Nuoto Backend — API Reference

## Purpose of this document

This document is the complete, self-contained specification for the Nuoto backend
REST API. It is written for an AI that needs to implement a frontend against this
service without access to the backend source code. Every constraint, data shape,
edge case, and recommended usage pattern is described here.

---

## Base URL and transport

```
http://localhost:8090
```

All responses are `Content-Type: application/json`. All requests use HTTP `GET`.
CORS is fully open (`Access-Control-Allow-Origin: *`), so the API can be called
directly from any browser origin.

---

## Common conventions

### Athlete `key`

Every athlete has a stable identifier called a **key**. It is the normalised,
lowercase filename of the athlete's index file, without the `.json` extension.
Examples: `rossi_mario`, `palestrini_aaliyah`, `accorroni_lucrezia`.

A key contains only the characters `[a-z0-9_]`. It is used as the `{id}` path
segment when fetching an athlete's stats.

### Event `dir`

Each competition is stored under a directory whose name is used as the **event dir**
identifier throughout the API. It contains only `[a-z0-9_]` characters.
Examples: `10061_secondo_trofeo_sogisport_nibionno_esordienti`,
`federnuoto_139890_36_meeting_citta_di_grosseto`.

### Time format

Race times use an apostrophe as the minute separator:

| Raw value | Meaning |
|---|---|
| `"25.34"` | 25.34 seconds |
| `"1'02.34"` | 1 minute 2.34 seconds |
| `"2'05.00"` | 2 minutes 5.00 seconds |

### Date format

The `date` field on competition records is **not normalised**. Two formats appear
depending on the data source:

| Source | Example |
|---|---|
| Federnuoto | `"15 Marzo 2024"` (Italian month name) |
| FICR | `"15/03/2024"` |

Parse defensively; display as-is if you do not need to sort by date.

### Error shape

All error responses share the same shape:

```json
{ "error": "<human-readable message>" }
```

| HTTP status | Meaning |
|---|---|
| `400` | Invalid path parameter (bad year format, forbidden characters in key/event) |
| `404` | Athlete key not found |
| `500` | Internal Redis error |
| `503` | Redis is unreachable (health endpoint only) |

---

## Endpoints

---

### `GET /health`

Checks whether the service and Redis are responsive.

**Response `200`**

```json
{ "status": "ok" }
```

**Response `503`**

```json
{ "error": "redis unavailable" }
```

**Usage note:** Poll this endpoint after `docker compose up` to know when the
service is ready before making data requests.

---

### `GET /api/years`

Returns the sorted list of years for which competition data exists.

**Response `200`** — array of year strings, ascending

```json
["2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]
```

**Usage note:** Use this as the first call to populate a year-picker. The list is
static after the service loads.

---

### `GET /api/events/{year}`

Returns all competitions that took place in the given year.

**Path parameters**

| Parameter | Format | Example |
|---|---|---|
| `year` | exactly 4 digits | `2024` |

**Response `200`** — array of `EventInfo`, sorted alphabetically by `name`

```json
[
  {
    "dir":  "10061_secondo_trofeo_sogisport_nibionno_esordienti",
    "name": "2° Trofeo Sogisport Nibionno Esordienti",
    "date": "15 Marzo 2024"
  },
  {
    "dir":  "federnuoto_139890_36_meeting_citta_di_grosseto",
    "name": "36^ Meeting città di Grosseto",
    "date": "15 Gennaio 2024"
  }
]
```

**Fields**

| Field | Type | Description |
|---|---|---|
| `dir` | string | Stable identifier for the event; use it in subsequent requests |
| `name` | string | Human-readable competition name; safe to display directly |
| `date` | string | Date string (see Date format section above) |

**Response `400`** — year is not a 4-digit string  
**Response `200` with `[]`** — year exists but has no indexed events

---

### `GET /api/events/{year}/{event}/athletes`

Returns all athletes who competed in a specific event.

**Path parameters**

| Parameter | Format | Example |
|---|---|---|
| `year` | exactly 4 digits | `2024` |
| `event` | `[a-z0-9_]+` | `10061_secondo_trofeo_sogisport_nibionno_esordienti` |

**Response `200`** — array of `AthleteInfo`, sorted alphabetically by `name`

```json
[
  {
    "key":          "abdeltawab_karim",
    "name":         "KARIM ABDELTAWAB",
    "year_of_birth": "2012",
    "sex":          "M",
    "society":      "GONZAGA SPORT CLUB SSD"
  },
  {
    "key":          "rossi_mario",
    "name":         "MARIO ROSSI",
    "year_of_birth": "1990",
    "sex":          "M",
    "society":      "NUOTO CLUB ROMA ASD"
  }
]
```

**Fields**

| Field | Type | Values |
|---|---|---|
| `key` | string | Athlete identifier; use as `{id}` in the stats endpoint |
| `name` | string | Upper-cased full name |
| `year_of_birth` | string | Four-digit year as a string |
| `sex` | string | `"M"` or `"F"` |
| `society` | string | Club or association name; mixed case |

**Response `400`** — invalid path parameters  
**Response `200` with `[]`** — event exists but no athletes are indexed for it

---

### `GET /api/athletes`

Returns all athletes, paginated, in alphabetical order by name.

**Query parameters**

| Parameter | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `page` | integer | `1` | ≥ 1 | 1-based page number |
| `limit` | integer | `50` | 1–200 | Number of athletes per page |

**Response `200`**

```json
{
  "page":     1,
  "limit":    50,
  "total":    132602,
  "athletes": [
    {
      "key":          "aaliyah_palestrini",
      "name":         "AALIYAH PALESTRINI",
      "year_of_birth": "2003",
      "sex":          "F",
      "society":      "Aurelia Nuoto asd"
    }
  ]
}
```

**Fields**

| Field | Type | Description |
|---|---|---|
| `page` | integer | Echo of the requested page |
| `limit` | integer | Echo of the applied limit (clamped to 1–200) |
| `total` | integer | Total number of athletes across all pages |
| `athletes` | array of `AthleteInfo` | See athlete fields in the previous endpoint |

**Usage notes**

- Total pages = `Math.ceil(total / limit)`.
- Athletes are sorted by name ascending. The sort is lexicographic on the
  upper-cased name, so `"AALIYAH …"` comes before `"MARIO …"`.
- `page` values beyond the last page return an empty `athletes` array (not an error).

---

### `GET /api/athletes/search`

Searches for athletes whose name contains the query fragment. Intended for
autocomplete / suggest-as-you-type input fields.

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | Fragment to search; case-insensitive; minimum 2 characters |

**Response `200`** — array of up to 20 `AthleteInfo` objects

```json
[
  {
    "key":          "palestrini_aaliyah",
    "name":         "AALIYAH PALESTRINI",
    "year_of_birth": "2003",
    "sex":          "F",
    "society":      "Aurelia Nuoto asd"
  }
]
```

Returns `[]` when `q` is shorter than 2 characters or no match is found.

**Search behaviour**

- Matching is **substring**, not prefix. Searching `"PIZZ"` matches
  `"ANGELO PIZZIGALLO"`.
- The comparison is done against the full upper-cased name, so `"rossi"`,
  `"ROSSI"`, and `"Rossi"` all match `"MARIO ROSSI"`.
- Results are returned in index-scan order (roughly alphabetical) and capped at 20.
- The search runs entirely in memory on the server; there is no Redis round-trip.
  It is safe to call on every keystroke with a debounce of ~150 ms.

**Recommended frontend pattern**

```
user types → debounce 150 ms → GET /api/athletes/search?q=<input>
                              → show up to 20 suggestions
user selects suggestion      → use suggestion.key to call /api/athletes/{key}/stats
```

---

### `GET /api/athletes/{id}/stats`

Returns the complete competition history and race results for a single athlete.

**Path parameters**

| Parameter | Format | Example |
|---|---|---|
| `id` | `[a-z0-9_]+` | `palestrini_aaliyah` |

The `id` is the athlete's `key` as returned by every other endpoint.

**Response `200`**

```json
{
  "key":          "palestrini_aaliyah",
  "name":         "AALIYAH PALESTRINI",
  "year_of_birth": "2003",
  "sex":          "F",
  "society":      "Aurelia Nuoto asd",
  "records": [
    {
      "competition": "36^ Meeting città di Grosseto",
      "date":        "15 Gennaio 2022",
      "year":        "2021",
      "event_dir":   "federnuoto_139890_36_meeting_citta_di_grosseto",
      "results": [
        {
          "event":    "100m Stile Libero",
          "category": "Juniores Femmine",
          "time":     "58.34",
          "position": 3,
          "splits": [
            { "metres": 50,  "time": "28.10" },
            { "metres": 100, "time": "58.34" }
          ]
        },
        {
          "event":    "200m Stile Libero",
          "category": "Juniores Femmine",
          "time":     "2'05.12",
          "position": 1,
          "splits": [
            { "metres":  50, "time": "29.40" },
            { "metres": 100, "time": "1'00.20" },
            { "metres": 150, "time": "1'32.80" },
            { "metres": 200, "time": "2'05.12" }
          ]
        }
      ]
    }
  ]
}
```

**Top-level fields**

| Field | Type | Description |
|---|---|---|
| `key` | string | Athlete's stable identifier |
| `name` | string | Upper-cased full name |
| `year_of_birth` | string | Four-digit year as a string |
| `sex` | string | `"M"` or `"F"` |
| `society` | string | Most recent club name |
| `records` | array of `StatRecord` | One entry per competition appearance, ordered by index insertion (not sorted by date) |

**`StatRecord` fields**

| Field | Type | Description |
|---|---|---|
| `competition` | string | Human-readable competition name |
| `date` | string | Date string (see Date format section) |
| `year` | string | Calendar year the competition was indexed under (e.g. `"2021"`) |
| `event_dir` | string | Event dir identifier; can be used to call `/api/events/{year}/{event}/athletes` |
| `results` | array of `Result` | All races the athlete competed in at this competition |

**`Result` fields**

| Field | Type | Description |
|---|---|---|
| `event` | string | Stroke and distance, e.g. `"50m Stile Libero"`, `"200m Farfalla"`, `"100m Rana"`, `"400m Misti"` |
| `category` | string | Age/gender category, e.g. `"Juniores Femmine"`, `"Assoluti Maschi"`, `"M40"` |
| `time` | string | Finishing time (see Time format section) |
| `position` | integer | Finishing position within the category heat (1 = first) |
| `splits` | array of `Split` | Intermediate split times; may be absent (`null` or missing key) |

**`Split` fields**

| Field | Type | Description |
|---|---|---|
| `metres` | integer | Distance at which this split was recorded, e.g. `50`, `100`, `150` |
| `time` | string | Cumulative elapsed time at this split (same format as `Result.time`) |

**Important edge cases**

- `records` can be an empty array `[]` if the athlete's files have not yet been
  loaded into Redis AND cannot be read from disk.
- `splits` is omitted entirely for events where intermediate times were not
  recorded (short sprints, older data). Always check for its presence before
  accessing it.
- The last split in `splits` always matches the `time` field of the result.
- `year` is the aggregation year (the directory under `aggregated/`) and may
  differ by one from the calendar year in `date` when a competition spans a
  year boundary (e.g. a January competition indexed under the previous year).

**Response `400`** — id contains characters outside `[a-z0-9_]`  
**Response `404`** — no athlete with that key exists

---

## Typical frontend flows

### Flow 1 — Browse competitions

```
1. GET /api/years
   → render year picker

2. user selects year → GET /api/events/{year}
   → render list of competitions

3. user selects competition → GET /api/events/{year}/{event}/athletes
   → render list of athletes, each showing name + club + birth year

4. user clicks athlete → GET /api/athletes/{key}/stats
   → render full competition history
```

### Flow 2 — Athlete search / autocomplete

```
1. render search input

2. on input (debounced 150 ms, min 2 chars):
   GET /api/athletes/search?q={input}
   → show dropdown of up to 20 suggestions
   → each suggestion shows: name, birth year, club

3. user selects suggestion → GET /api/athletes/{key}/stats
   → render full competition history
```

### Flow 3 — Browse all athletes

```
1. GET /api/athletes?page=1&limit=50
   → render paginated table; use total to compute page count

2. on page change: GET /api/athletes?page={n}&limit=50
```

---

## TypeScript types

The following types match the exact JSON shapes returned by the API and can be
copied directly into a TypeScript frontend.

```typescript
export interface EventInfo {
  dir:  string;
  name: string;
  date: string;
}

export interface AthleteInfo {
  key:          string;
  name:         string;
  year_of_birth: string;
  sex:          "M" | "F";
  society:      string;
}

export interface AthletePage {
  page:     number;
  limit:    number;
  total:    number;
  athletes: AthleteInfo[];
}

export interface Split {
  metres: number;
  time:   string;
}

export interface Result {
  event:    string;
  category: string;
  time:     string;
  position: number;
  splits?:  Split[];
}

export interface StatRecord {
  competition: string;
  date:        string;
  year:        string;
  event_dir:   string;
  results:     Result[];
}

export interface AthleteStats {
  key:          string;
  name:         string;
  year_of_birth: string;
  sex:          "M" | "F";
  society:      string;
  records:      StatRecord[];
}

export interface ApiError {
  error: string;
}
```

---

## Minimal fetch helper

```typescript
const BASE = "http://localhost:8090";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  const data = await res.json();
  if (!res.ok) throw new Error((data as ApiError).error ?? res.statusText);
  return data as T;
}

// Examples
const years   = await get<string[]>("/api/years");
const events  = await get<EventInfo[]>("/api/events/2024");
const athletes = await get<AthleteInfo[]>("/api/events/2024/10061_secondo_trofeo_sogisport_nibionno_esordienti/athletes");
const page    = await get<AthletePage>("/api/athletes?page=1&limit=50");
const suggestions = await get<AthleteInfo[]>("/api/athletes/search?q=rossi");
const stats   = await get<AthleteStats>("/api/athletes/palestrini_aaliyah/stats");
```
