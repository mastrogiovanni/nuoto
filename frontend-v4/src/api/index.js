const BASE = import.meta.env.VITE_API_BASE_URL || ''

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

// ── Stats cache ─────────────────────────────────────────────────────────────
const CACHE_MIN = 2 * 60 * 1000
const CACHE_MAX = 6 * 60 * 1000
const statsCache = {}

function randomTTL() {
  return CACHE_MIN + Math.random() * (CACHE_MAX - CACHE_MIN)
}

export async function fetchStats(key) {
  const entry = statsCache[key]
  if (entry && Date.now() < entry.expiresAt) return entry.promise
  const promise = get(`/api/athletes/${encodeURIComponent(key)}/stats`)
  statsCache[key] = { promise, expiresAt: Date.now() + randomTTL() }
  return promise
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function searchAthletes(q) {
  if (!q || q.trim().length < 2) return []
  const athletes = await get(`/api/athletes/search?q=${encodeURIComponent(q.trim())}`)
  return athletes
}

export async function getAthleteStats(key) {
  return fetchStats(key)
}

export async function getYears() {
  return get('/api/years')
}

export async function getEvents(year) {
  return get(`/api/events/${encodeURIComponent(year)}`)
}

export async function getEventAthletes(year, eventDir) {
  return get(`/api/events/${encodeURIComponent(year)}/${encodeURIComponent(eventDir)}/athletes`)
}

export async function getRecordsMeta() {
  return get('/api/records')
}

export async function getRecords(vasca, championship, gender) {
  return get(`/api/records/${encodeURIComponent(vasca)}/${encodeURIComponent(championship)}/${encodeURIComponent(gender)}`)
}

// Fetch stats for multiple athletes in parallel with concurrency limit
export async function fetchStatsBatch(keys, onProgress) {
  const BATCH = 10
  const results = {}
  let done = 0
  for (let i = 0; i < keys.length; i += BATCH) {
    const slice = keys.slice(i, i + BATCH)
    const settled = await Promise.allSettled(slice.map(k => fetchStats(k)))
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled') results[slice[j]] = r.value
      done++
    })
    if (onProgress) onProgress(done, keys.length)
  }
  return results
}
