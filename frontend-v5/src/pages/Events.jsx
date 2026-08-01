import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getYears, getEvents, getEventAthletes } from '../api'
import { toSwimmer, parseDate, formatDateLocal } from '../utils'

export default function Events() {
  const navigate = useNavigate()

  const [years, setYears] = useState([])
  const [year, setYear] = useState('')
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)

  const [selectedEvent, setSelectedEvent] = useState(null) // {dir, name, date}
  const [athletes, setAthletes] = useState([])
  const [athLoading, setAthLoading] = useState(false)

  const [search, setSearch] = useState('')

  useEffect(() => {
    getYears().then(y => {
      const sorted = [...y].sort().reverse()
      setYears(sorted)
      if (sorted.length > 0) setYear(sorted[0])
    })
  }, [])

  useEffect(() => {
    if (!year) return
    setEventsLoading(true)
    setSelectedEvent(null)
    setAthletes([])
    getEvents(year)
      .then(data => { setEvents(data); setEventsLoading(false) })
      .catch(() => setEventsLoading(false))
  }, [year])

  function selectEvent(ev) {
    setSelectedEvent(ev)
    setAthletes([])
    setSearch('')
    setAthLoading(true)
    getEventAthletes(year, ev.dir)
      .then(data => { setAthletes(data); setAthLoading(false) })
      .catch(() => setAthLoading(false))
  }

  const filteredEvents = search
    ? events.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : events

  const filteredAthletes = athletes

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Manifestazioni</h1>
        <p className="page-subtitle">Archivio gare e atleti partecipanti</p>
      </div>

      {/* Year selector */}
      <div className="card" style={{ padding: 14 }}>
        <span className="filter-label">Stagione</span>
        <div className="seg-ctrl" style={{ flexWrap: 'wrap' }}>
          {years.slice(0, 8).map(y => (
            <button
              key={y}
              className={`seg-btn${year === y ? ' active' : ''}`}
              onClick={() => setYear(y)}
              style={{ flex: 'none', padding: '6px 10px' }}
            >
              {y}
            </button>
          ))}
        </div>
        {years.length > 8 && (
          <select
            className="filter-select"
            style={{ marginTop: 8 }}
            value={year}
            onChange={e => setYear(e.target.value)}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {/* Event list */}
      <div>
        <div className="section-header">
          <h2 className="section-title">Competizioni {year}</h2>
          {events.length > 0 && <span className="pill">{events.length}</span>}
        </div>

        {events.length > 5 && (
          <div className="search-wrap" style={{ marginBottom: 10 }}>
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-input"
              type="search"
              placeholder="Cerca competizione…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            />
          </div>
        )}

        {eventsLoading ? (
          <div className="loading-center" style={{ padding: 24 }}>
            <span className="spinner spinner--sm" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📅</span>
            <p>{search ? 'Nessuna competizione trovata.' : `Nessuna competizione disponibile per ${year}.`}</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredEvents.map((ev, i) => {
              const isSelected = selectedEvent?.dir === ev.dir
              const isoDate = parseDate(ev.date)
              return (
                <button
                  key={ev.dir}
                  onClick={() => selectEvent(ev)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', textAlign: 'left',
                    padding: '12px 16px',
                    borderBottom: i < filteredEvents.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isSelected ? 'var(--primary-xlight)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                    background: isSelected ? 'var(--primary-light)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem',
                  }}>
                    🏊
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.3,
                      color: isSelected ? 'var(--primary)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ev.name}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatDateLocal(isoDate) || ev.date}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected event — athlete list */}
      {selectedEvent && (
        <div>
          <div className="section-header">
            <div>
              <h2 className="section-title" style={{ fontSize: '0.95rem' }}>{selectedEvent.name}</h2>
              <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {formatDateLocal(parseDate(selectedEvent.date)) || selectedEvent.date}
              </p>
            </div>
            {athletes.length > 0 && <span className="pill">{athletes.length} atleti</span>}
          </div>

          {athLoading ? (
            <div className="loading-center" style={{ padding: 24 }}>
              <span className="spinner" />
              <p>Caricamento atleti…</p>
            </div>
          ) : filteredAthletes.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">👤</span>
              <p>Nessun atleta trovato per questa manifestazione.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {filteredAthletes.map((a, i) => {
                const sw = toSwimmer(a)
                return (
                  <div
                    key={a.key}
                    className="athlete-row"
                    onClick={() => navigate(`/athlete/${encodeURIComponent(a.key)}`)}
                  >
                    <div className="athlete-avatar">{sw.initials}</div>
                    <div className="athlete-info">
                      <div className="athlete-name">{sw.displayName}</div>
                      <div className="athlete-meta">{sw.club} · {sw.birthYear} · {a.sex}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
