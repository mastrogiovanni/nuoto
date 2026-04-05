/**
 * API module — currently returns fake data.
 * Replace each function body with a real fetch/axios call in the future.
 *
 * Base URL placeholder:
 *   const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.nuoto.example.com'
 */

// ─── Fake data ────────────────────────────────────────────────────────────────

const SWIMMERS = [
  { id: 1, name: 'Rossi',     firstName: 'Marco',    club: 'Aqua Sport Roma',    birthYear: 2005, avatarInitials: 'MR' },
  { id: 2, name: 'Bianchi',   firstName: 'Sofia',    club: 'Nuoto Torino',       birthYear: 2004, avatarInitials: 'SB' },
  { id: 3, name: 'Ferrari',   firstName: 'Luca',     club: 'Aqua Sport Roma',    birthYear: 2006, avatarInitials: 'LF' },
  { id: 4, name: 'Russo',     firstName: 'Giulia',   club: 'Palermo Nuoto',      birthYear: 2003, avatarInitials: 'GR' },
  { id: 5, name: 'Esposito',  firstName: 'Andrea',   club: 'Venezia Swim',       birthYear: 2005, avatarInitials: 'AE' },
  { id: 6, name: 'Conti',     firstName: 'Martina',  club: 'Nuoto Torino',       birthYear: 2007, avatarInitials: 'MC' },
  { id: 7, name: 'Ricci',     firstName: 'Davide',   club: 'Genova Waves',       birthYear: 2004, avatarInitials: 'DR' },
  { id: 8, name: 'Lombardi',  firstName: 'Chiara',   club: 'Venezia Swim',       birthYear: 2006, avatarInitials: 'CL' },
]

// Styles: stile libero, dorso, rana, delfino, misto
const STYLES = ['Stile libero', 'Dorso', 'Rana', 'Delfino', 'Misto']
const DISTANCES = [50, 100, 200, 400, 800, 1500]
const COMPETITIONS = [
  'Campionato Regionale Lazio',
  'Trofeo Città di Roma',
  'Meeting Nazionale Giovanile',
  'Gran Premio Aqua Sport',
  'Campionato Italiano Under 18',
  'Trofeo del Mediterraneo',
  'Meeting Internazionale di Torino',
]
const POOLS = ['25m', '50m']

function randomTime(distanceMeters, style) {
  // Rough base seconds per 50m for each style
  const basePer50 = {
    'Stile libero': 30,
    'Dorso':        34,
    'Rana':         38,
    'Delfino':      33,
    'Misto':        35,
  }
  const laps = distanceMeters / 50
  const base = (basePer50[style] ?? 32) * laps
  // Add random variation ±10%
  const variation = base * (Math.random() * 0.2 - 0.1)
  const totalSeconds = base + variation
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const hundredths = Math.floor(Math.random() * 100)
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
  }
  return `${seconds}.${String(hundredths).padStart(2, '0')}`
}

function timeToSeconds(timeStr) {
  if (timeStr.includes(':')) {
    const [min, rest] = timeStr.split(':')
    return parseInt(min) * 60 + parseFloat(rest)
  }
  return parseFloat(timeStr)
}

function generateResults(swimmerId) {
  const results = []
  let id = swimmerId * 1000

  const year = 2024
  for (let month = 1; month <= 12; month++) {
    const numEvents = Math.floor(Math.random() * 3) + 1
    for (let e = 0; e < numEvents; e++) {
      const day = Math.floor(Math.random() * 28) + 1
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const competition = COMPETITIONS[Math.floor(Math.random() * COMPETITIONS.length)]
      const pool = POOLS[Math.floor(Math.random() * POOLS.length)]
      const style = STYLES[Math.floor(Math.random() * STYLES.length)]
      const distance = DISTANCES[Math.floor(Math.random() * DISTANCES.length)]
      const time = randomTime(distance, style)
      const points = Math.floor(Math.random() * 400) + 400
      const position = Math.floor(Math.random() * 20) + 1

      results.push({ id: id++, swimmerId, date, competition, pool, style, distance, time, points, position })
    }
  }

  // Sort by date desc
  results.sort((a, b) => new Date(b.date) - new Date(a.date))
  return results
}

// Pre-generate all results
const ALL_RESULTS = {}
SWIMMERS.forEach(s => {
  ALL_RESULTS[s.id] = generateResults(s.id)
})

function getBestTimes(swimmerId) {
  const results = ALL_RESULTS[swimmerId] || []
  const best = {}
  results.forEach(r => {
    const key = `${r.style} ${r.distance}m`
    if (!best[key] || timeToSeconds(r.time) < timeToSeconds(best[key].time)) {
      best[key] = r
    }
  })
  return Object.values(best).sort((a, b) => a.style.localeCompare(b.style) || a.distance - b.distance)
}

// ─── Simulated network delay ──────────────────────────────────────────────────

function delay(ms = 300) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search swimmers by surname prefix.
 * @param {string} surname
 * @returns {Promise<Array>}
 */
export async function searchSwimmers(surname) {
  await delay(400)
  if (!surname || surname.trim().length < 1) return []
  const q = surname.trim().toLowerCase()
  return SWIMMERS.filter(s => s.name.toLowerCase().startsWith(q))
}

/**
 * Get full swimmer profile by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getSwimmer(id) {
  await delay(200)
  return SWIMMERS.find(s => s.id === id) || null
}

/**
 * Get all results for a swimmer.
 * @param {number} swimmerId
 * @param {Object} filters  { style, distance, year }
 * @returns {Promise<Array>}
 */
export async function getResults(swimmerId, filters = {}) {
  await delay(350)
  let results = ALL_RESULTS[swimmerId] || []
  if (filters.style)    results = results.filter(r => r.style === filters.style)
  if (filters.distance) results = results.filter(r => r.distance === Number(filters.distance))
  if (filters.year)     results = results.filter(r => r.date.startsWith(String(filters.year)))
  return results
}

/**
 * Get personal best times for a swimmer (one per event type).
 * @param {number} swimmerId
 * @returns {Promise<Array>}
 */
export async function getBestTimesForSwimmer(swimmerId) {
  await delay(250)
  return getBestTimes(swimmerId)
}

/**
 * Compare two swimmers' best times side by side.
 * Returns array of { event, swimmerA, swimmerB } where each entry has time info.
 * @param {number} idA
 * @param {number} idB
 * @returns {Promise<Array>}
 */
export async function compareSwimmers(idA, idB) {
  await delay(500)
  const bestA = getBestTimes(idA)
  const bestB = getBestTimes(idB)

  // Collect all unique event keys
  const eventsA = Object.fromEntries(bestA.map(r => [`${r.style} ${r.distance}m`, r]))
  const eventsB = Object.fromEntries(bestB.map(r => [`${r.style} ${r.distance}m`, r]))
  const allEvents = new Set([...Object.keys(eventsA), ...Object.keys(eventsB)])

  return Array.from(allEvents)
    .sort()
    .map(event => ({
      event,
      swimmerA: eventsA[event] || null,
      swimmerB: eventsB[event] || null,
    }))
}

export { STYLES, DISTANCES }
