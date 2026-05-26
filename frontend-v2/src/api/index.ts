import type {
  BackendAthleteInfo,
  BackendAthleteStats,
  BackendNationalRecordsIndexEntry,
  BackendNationalRecordsPage,
  Swimmer,
  RaceResult,
  PersonalBest,
  NationalRecord,
  NationalRecordsIndexEntry,
  EventInfo,
  Competition,
} from '../types'
import {
  parseDate,
  normalizeTime,
  parseEvent,
  timeToSeconds,
  formatAthleteNameFull,
  getFirstName,
  getLastName,
  getInitials,
} from '../utils/time'
import { getCategory } from '../utils/qualification'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

// ─── HTTP helper ───────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText)
  return data as T
}

// ─── Stats cache ───────────────────────────────────────────────────────────────

interface CacheEntry {
  promise: Promise<BackendAthleteStats>
  expiresAt: number
}

const statsCache = new Map<string, CacheEntry>()

function randomTTL() {
  return 60_000 + Math.random() * 240_000
}

async function fetchStats(key: string): Promise<BackendAthleteStats> {
  const entry = statsCache.get(key)
  if (entry && Date.now() < entry.expiresAt) return entry.promise
  const promise = get<BackendAthleteStats>(`/api/athletes/${encodeURIComponent(key)}/stats`)
  statsCache.set(key, { promise, expiresAt: Date.now() + randomTTL() })
  return promise
}

// ─── Transformers ──────────────────────────────────────────────────────────────

export function toSwimmer(athlete: BackendAthleteInfo): Swimmer {
  const sex = athlete.sex?.toUpperCase() === 'F' ? ('F' as const) : ('M' as const)
  return {
    id: athlete.key,
    fullName: formatAthleteNameFull(athlete.name),
    firstName: getFirstName(athlete.name),
    lastName: getLastName(athlete.name),
    initials: getInitials(athlete.name),
    club: athlete.society ?? '',
    birthYear: athlete.year_of_birth,
    sex,
    category: getCategory(athlete.year_of_birth),
  }
}

function toResults(stats: BackendAthleteStats): RaceResult[] {
  const results: RaceResult[] = []
  let id = 0
  for (const record of stats.records ?? []) {
    const date = parseDate(record.date)
    for (const result of record.results ?? []) {
      const { distance, style } = parseEvent(result.event)
      const time = normalizeTime(result.time)
      results.push({
        id: String(id++),
        competitionName: record.competition,
        date,
        year: record.year,
        style,
        distance,
        time,
        timeSeconds: timeToSeconds(time),
        position: result.position ?? 0,
        category: result.category ?? '',
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

// ─── Public API ────────────────────────────────────────────────────────────────

export async function searchSwimmers(q: string): Promise<Swimmer[]> {
  if (!q || q.trim().length < 2) return []
  const athletes = await get<BackendAthleteInfo[]>(
    `/api/athletes/search?q=${encodeURIComponent(q.trim())}`,
  )
  return athletes.map(toSwimmer)
}

export async function getSwimmer(key: string): Promise<Swimmer | null> {
  try {
    const stats = await fetchStats(key)
    return toSwimmer(stats)
  } catch {
    return null
  }
}

export async function getResults(
  swimmerKey: string,
  filters: { style?: string; distance?: number; year?: string } = {},
): Promise<RaceResult[]> {
  const stats = await fetchStats(swimmerKey)
  let results = toResults(stats)
  if (filters.style)    results = results.filter(r => r.style === filters.style)
  if (filters.distance) results = results.filter(r => r.distance === filters.distance)
  if (filters.year)     results = results.filter(r => r.year === filters.year)
  return results
}

export async function getPersonalBests(swimmerKey: string): Promise<PersonalBest[]> {
  const results = await getResults(swimmerKey)
  const best = new Map<string, RaceResult>()
  for (const r of results) {
    if (!r.time || !isFinite(r.timeSeconds)) continue
    const key = `${r.style}||${r.distance}`
    const existing = best.get(key)
    if (!existing || r.timeSeconds < existing.timeSeconds) {
      best.set(key, r)
    }
  }
  return Array.from(best.values())
    .sort((a, b) => a.style.localeCompare(b.style) || a.distance - b.distance)
    .map(r => ({
      style: r.style,
      distance: r.distance,
      time: r.time,
      timeSeconds: r.timeSeconds,
      date: r.date,
      competitionName: r.competitionName,
      category: r.category,
    }))
}

export async function getCompetitions(swimmerKey: string): Promise<Competition[]> {
  const results = await getResults(swimmerKey)
  const map = new Map<string, Competition>()
  for (const r of results) {
    const key = `${r.competitionName}__${r.date}`
    if (!map.has(key)) {
      map.set(key, { key, name: r.competitionName, date: r.date, year: r.year, results: [] })
    }
    map.get(key)!.results.push(r)
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
}

export async function getProgressionForEvent(
  swimmerKey: string,
  style: string,
  distance: number,
): Promise<RaceResult[]> {
  const results = await getResults(swimmerKey, { style, distance })
  return results
    .filter(r => isFinite(r.timeSeconds))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getYears(): Promise<string[]> {
  return get<string[]>('/api/years')
}

export async function getEvents(year: string): Promise<EventInfo[]> {
  const data = await get<Record<string, EventInfo>>(`/api/events/${encodeURIComponent(year)}`)
  return Object.values(data)
}

export async function getEventAthletes(year: string, event: string): Promise<Swimmer[]> {
  const athletes = await get<BackendAthleteInfo[]>(
    `/api/events/${encodeURIComponent(year)}/${encodeURIComponent(event)}/athletes`,
  )
  return athletes.map(toSwimmer)
}

export async function getRecordsMeta(): Promise<NationalRecordsIndexEntry[]> {
  const data = await get<BackendNationalRecordsIndexEntry[]>('/api/records')
  return data.map(d => ({ vasca: d.vasca, championship: d.championship, gender: d.gender }))
}

export async function getNationalRecords(
  vasca: string,
  championship: string,
  gender: string,
): Promise<NationalRecord[]> {
  const data = await get<BackendNationalRecordsPage>(
    `/api/records/${encodeURIComponent(vasca)}/${encodeURIComponent(championship)}/${encodeURIComponent(gender)}`,
  )
  return (data.records ?? []).map(r => ({
    specialita: r.specialita,
    athlete: r.atleta,
    time: r.tempo,
    date: r.data,
    location: r.luogo,
    section: r.sezione,
    components: r.componenti,
  }))
}

// Fetch ranking: athletes in an event for a year, with their best times.
// Caps at 50 athletes to avoid excessive requests.
export async function getRanking(
  year: string,
  eventKey: string,
): Promise<Array<{ swimmer: Swimmer; result: RaceResult | null }>> {
  const athletes = await getEventAthletes(year, eventKey)

  const { style, distance } = parseEvent(eventKey.replace(/_/g, ' '))

  const withTimes = await Promise.all(
    athletes.slice(0, 50).map(async swimmer => {
      try {
        const results = await getResults(swimmer.id, { style, distance, year })
        const best = results
          .filter(r => isFinite(r.timeSeconds))
          .sort((a, b) => a.timeSeconds - b.timeSeconds)[0] ?? null
        return { swimmer, result: best }
      } catch {
        return { swimmer, result: null }
      }
    }),
  )

  return withTimes.sort((a, b) => {
    const ta = a.result?.timeSeconds ?? Infinity
    const tb = b.result?.timeSeconds ?? Infinity
    return ta - tb
  })
}
