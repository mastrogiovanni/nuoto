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

// Stats cache with random TTL to avoid thundering-herd on expiry
const CACHE_MIN = 2 * 60 * 1000
const CACHE_MAX = 8 * 60 * 1000
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

export async function searchAthletes(q) {
  if (!q || q.trim().length < 2) return []
  return get(`/api/athletes/search?q=${encodeURIComponent(q.trim())}`)
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

// Fetch stats for multiple athletes with concurrency limit and progress callback
export async function fetchStatsBatch(keys, onProgress) {
  const BATCH = 12
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

// Load athlete lists for multiple events in parallel, return merged unique athlete map
export async function fetchEventAthletesMulti(year, eventDirs, onProgress) {
  const BATCH = 8
  const athleteMap = {}
  let done = 0
  for (let i = 0; i < eventDirs.length; i += BATCH) {
    const slice = eventDirs.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      slice.map(dir => getEventAthletes(year, dir))
    )
    settled.forEach(r => {
      if (r.status === 'fulfilled') {
        r.value.forEach(a => { athleteMap[a.key] = a })
      }
    })
    done += slice.length
    if (onProgress) onProgress(done, eventDirs.length)
  }
  return athleteMap
}
