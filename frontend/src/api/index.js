/**
 * API layer — all calls go to the Nuoto backend (see API.md).
 *
 * Base URL is configured via the VITE_API_BASE_URL env variable.
 * When empty (default) the browser calls relative paths so that the nginx
 * reverse-proxy (or the Vite dev-server proxy) routes /api/* to the backend.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || ''

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function authHeaders() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data
}

// ─── Data transformers ────────────────────────────────────────────────────────

const ITALIAN_MONTHS = {
  'Gennaio': '01', 'Febbraio': '02', 'Marzo': '03', 'Aprile': '04',
  'Maggio': '05', 'Giugno': '06', 'Luglio': '07', 'Agosto': '08',
  'Settembre': '09', 'Ottobre': '10', 'Novembre': '11', 'Dicembre': '12',
}

/**
 * Normalize backend date strings to YYYY-MM-DD.
 * Handles "15 Marzo 2024" and "15/03/2024".
 */
function parseDate(dateStr) {
  if (!dateStr) return ''
  const itMatch = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (itMatch) {
    const month = ITALIAN_MONTHS[itMatch[2]] ?? '01'
    return `${itMatch[3]}-${month}-${itMatch[1].padStart(2, '0')}`
  }
  const slashMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`
  }
  return dateStr
}

/**
 * Normalize backend time format (apostrophe separator) to colon separator.
 * "1'02.34" → "1:02.34"
 */
function normalizeTime(t) {
  return t ? t.replace("'", ':') : ''
}

/**
 * Parse backend event string "100m Stile Libero" into distance + style.
 */
function parseEvent(eventStr) {
  const m = eventStr?.match(/^(\d+)m\s+(.+)$/)
  if (m) return { distance: parseInt(m[1]), style: m[2] }
  return { distance: 0, style: eventStr ?? '' }
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Convert an AthleteInfo object (backend shape) to the swimmer shape used
 * throughout the frontend pages.
 *
 * Backend:  { key, name, year_of_birth, sex, society }
 * Frontend: { id, key, name, firstName, club, birthYear, sex, avatarInitials }
 *
 * Backend name is upper-cased full name e.g. "MARIO ROSSI".
 * We split on the last word to get surname / first name.
 */
function toSwimmer(athlete) {
  const parts = athlete.name.trim().split(/\s+/)
  const lastName = parts[parts.length - 1]
  const firstNames = parts.slice(0, -1)
  const initials = (
    (firstNames[0]?.[0] ?? '') + (lastName[0] ?? '')
  ).toUpperCase()
  return {
    id: athlete.key,          // kept for backward-compat with page code
    key: athlete.key,
    name: titleCase(lastName),
    firstName: firstNames.length > 0 ? titleCase(firstNames.join(' ')) : titleCase(lastName),
    club: athlete.society,
    birthYear: athlete.year_of_birth,
    sex: athlete.sex,
    avatarInitials: initials || '?',
  }
}

/**
 * Flatten an AthleteStats object into the flat result array used by pages.
 *
 * Each StatRecord can contain multiple Result entries; we emit one flat object
 * per race, deriving style/distance from the "event" string.
 */
function toResults(stats) {
  const results = []
  let id = 0
  for (const record of stats.records ?? []) {
    const date = parseDate(record.date)
    for (const result of record.results ?? []) {
      const { distance, style } = parseEvent(result.event)
      results.push({
        id: id++,
        swimmerId: stats.key,
        date,
        competition: record.competition,
        year: record.year,
        pool: '',                        // not available in backend data
        style,
        distance,
        time: normalizeTime(result.time),
        position: result.position,
        category: result.category,
        splits: (result.splits ?? []).map(s => ({
          metres: s.metres,
          time: normalizeTime(s.time),
        })),
      })
    }
  }
  results.sort((a, b) => b.date.localeCompare(a.date))
  return results
}

function parseTimeToSeconds(t) {
  if (!t) return Infinity
  let secs
  if (t.includes(':')) {
    const [m, s] = t.split(':')
    secs = parseInt(m) * 60 + parseFloat(s)
  } else {
    secs = parseFloat(t)
  }
  return isNaN(secs) ? Infinity : secs
}

// ─── Simple in-memory stats cache ─────────────────────────────────────────────
// Stores the fetch Promise so concurrent calls share one in-flight request.

const statsCache = {}

async function fetchStats(key) {
  if (!statsCache[key]) {
    statsCache[key] = get(`/api/athletes/${encodeURIComponent(key)}/stats`)
  }
  return statsCache[key]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search athletes whose name contains `q` (case-insensitive, min 2 chars).
 * Returns up to 20 results as swimmer objects.
 */
export async function searchSwimmers(q) {
  if (!q || q.trim().length < 2) return []
  const athletes = await get(`/api/athletes/search?q=${encodeURIComponent(q.trim())}`)
  return athletes.map(toSwimmer)
}

/**
 * Fetch a single swimmer by key.
 */
export async function getSwimmer(key) {
  try {
    const stats = await fetchStats(key)
    return toSwimmer(stats)
  } catch {
    return null
  }
}

/**
 * Return all race results for a swimmer, optionally filtered.
 * `filters` may contain: { style, distance, year }
 */
export async function getResults(swimmerKey, filters = {}) {
  const stats = await fetchStats(swimmerKey)
  let results = toResults(stats)
  if (filters.style)    results = results.filter(r => r.style === filters.style)
  if (filters.distance) results = results.filter(r => r.distance === Number(filters.distance))
  if (filters.year)     results = results.filter(r => r.date.startsWith(String(filters.year)))
  return results
}

/**
 * Return the personal-best result for each (style, distance) combination.
 */
export async function getBestTimesForSwimmer(swimmerKey) {
  const results = await getResults(swimmerKey)
  const best = {}
  results.forEach(r => {
    if (!r.time) return
    const key = `${r.style}||${r.distance}`
    if (!best[key] || parseTimeToSeconds(r.time) < parseTimeToSeconds(best[key].time)) {
      best[key] = r
    }
  })
  return Object.values(best).sort(
    (a, b) => a.style.localeCompare(b.style) || a.distance - b.distance
  )
}

/**
 * Return the index of available national record sets.
 * Each entry: { vasca, championship, gender }
 */
export async function getRecordsMeta() {
  return get('/api/records')
}

/**
 * Return the national records page for the given combination.
 * gender must be 'M' or 'F'.
 */
export async function getRecords(vasca, championship, gender) {
  return get(`/api/records/${encodeURIComponent(vasca)}/${encodeURIComponent(championship)}/${encodeURIComponent(gender)}`)
}

/**
 * Compare two swimmers' personal bests side by side.
 * Returns an array of { event, swimmerA, swimmerB } entries.
 */
export async function compareSwimmers(keyA, keyB) {
  const [statsA, statsB] = await Promise.all([fetchStats(keyA), fetchStats(keyB)])
  const resultsA = toResults(statsA)
  const resultsB = toResults(statsB)

  function getBests(results) {
    const best = {}
    results.forEach(r => {
      if (!r.time) return
      const key = `${r.style} ${r.distance}m`
      if (!best[key] || parseTimeToSeconds(r.time) < parseTimeToSeconds(best[key].time)) {
        best[key] = r
      }
    })
    return best
  }

  const bestA = getBests(resultsA)
  const bestB = getBests(resultsB)
  const allEvents = new Set([...Object.keys(bestA), ...Object.keys(bestB)])

  return Array.from(allEvents)
    .sort()
    .map(event => ({
      event,
      swimmerA: bestA[event] ?? null,
      swimmerB: bestB[event] ?? null,
    }))
}
