import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getYears, getEvents } from '../api'
import type { EventInfo } from '../types'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'

const STYLE_EMOJI: Record<string, string> = {
  'stile': '🌊', 'libero': '🌊', 'dorso': '🔄', 'rana': '🐸', 'delfino': '🐬', 'misto': '🔀',
}

function eventEmoji(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, emoji] of Object.entries(STYLE_EMOJI)) {
    if (lower.includes(key)) return emoji
  }
  return '🏊'
}

function normalizeEventName(name: string): string {
  return name.replace(/_/g, ' ')
}

// Group events by style family
function groupEvents(events: EventInfo[]): Record<string, EventInfo[]> {
  const groups: Record<string, EventInfo[]> = {}
  for (const ev of events) {
    const lower = ev.name.toLowerCase()
    let group = 'Altro'
    if (lower.includes('stile') || lower.includes('libero') || lower.includes('sl')) group = 'Stile Libero'
    else if (lower.includes('dorso')) group = 'Dorso'
    else if (lower.includes('rana')) group = 'Rana'
    else if (lower.includes('delfino') || lower.includes('farfalla')) group = 'Delfino'
    else if (lower.includes('misto')) group = 'Misto'
    if (!groups[group]) groups[group] = []
    groups[group].push(ev)
  }
  return groups
}

export default function Rankings() {
  const navigate = useNavigate()
  const [years, setYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [events, setEvents] = useState<EventInfo[]>([])
  const [loadingYears, setLoadingYears] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getYears().then(ys => {
      const sorted = [...ys].sort().reverse()
      setYears(sorted)
      if (sorted.length > 0) setSelectedYear(sorted[0])
      setLoadingYears(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedYear) return
    setLoadingEvents(true)
    setEvents([])
    getEvents(selectedYear).then(evs => {
      setEvents(evs)
      setLoadingEvents(false)
    }).catch(() => setLoadingEvents(false))
  }, [selectedYear])

  const filtered = events.filter(ev =>
    normalizeEventName(ev.name).toLowerCase().includes(search.toLowerCase()),
  )
  const grouped = groupEvents(filtered)

  return (
    <div className="page-content">
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Classifiche</h1>
        <p className="page-subtitle">Scegli una gara per vedere la classifica</p>
      </div>

      {loadingYears ? (
        <LoadingState />
      ) : (
        <>
          {/* Year selector */}
          <div className="filter-row" style={{ marginBottom: 14 }}>
            <select
              className="filter-select"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Search events */}
          <div className="search-bar" style={{ marginBottom: 14 }}>
            <span className="search-bar-icon">🔍</span>
            <input
              className="search-bar-input"
              type="search"
              placeholder="Cerca gara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loadingEvents ? (
            <LoadingState text="Caricamento gare..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🏊"
              title="Nessuna gara trovata"
              subtitle={search ? `Nessun risultato per "${search}"` : 'Nessuna gara disponibile per questa stagione'}
              action={search ? { label: 'Cancella filtro', onClick: () => setSearch('') } : undefined}
            />
          ) : (
            <div>
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, evs]) => (
                <section key={group} className="section">
                  <h2 className="section-title">
                    {eventEmoji(group)} {group}
                  </h2>
                  <div className="event-list">
                    {evs.map(ev => (
                      <button
                        key={ev.name}
                        className="event-list-item"
                        onClick={() => navigate(`/rankings/${encodeURIComponent(selectedYear)}/${encodeURIComponent(ev.name)}`)}
                      >
                        <span className="event-list-icon">{eventEmoji(ev.name)}</span>
                        <span className="event-list-name">{normalizeEventName(ev.name)}</span>
                        <span className="event-list-arrow">›</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
