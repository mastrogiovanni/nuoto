import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getYears, getEvents, getEventAthletes, fetchStatsBatch } from '../api'
import { toSwimmer, toResults, parseTimeToSeconds, formatTime, formatDateLocal, parseDate, rankLabel } from '../utils'

const STYLE_HUE = {
  'Stile libero': '#2563EB',
  'Dorso':        '#7C3AED',
  'Rana':         '#059669',
  'Delfino':      '#0891B2',
  'Misto':        '#B45309',
}

export default function Ranking() {
  const navigate = useNavigate()

  // Step 1 — pick year
  const [years, setYears] = useState([])
  const [year, setYear] = useState('')

  // Step 2 — pick competition
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null) // { dir, name, date }

  // Step 3 — filters + load ranking
  const [gender, setGender] = useState('')
  const [racePick, setRacePick] = useState('') // "style||distance"
  const [categoryPick, setCategoryPick] = useState('')

  // Loading state
  const [athletes, setAthletes] = useState([]) // AthleteInfo[]
  const [statsMap, setStatsMap] = useState({})
  const [loadProgress, setLoadProgress] = useState(null) // { done, total }
  const [rankLoading, setRankLoading] = useState(false)

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
    setStatsMap({})
    setRacePick('')
    setCategoryPick('')
    getEvents(year)
      .then(data => { setEvents(data); setEventsLoading(false) })
      .catch(() => setEventsLoading(false))
  }, [year])

  async function loadRanking(ev) {
    setSelectedEvent(ev)
    setAthletes([])
    setStatsMap({})
    setRacePick('')
    setCategoryPick('')
    setLoadProgress(null)
    setRankLoading(true)

    try {
      const aths = await getEventAthletes(year, ev.dir)
      setAthletes(aths)

      const keys = aths.map(a => a.key)
      const map = await fetchStatsBatch(keys, (done, total) => {
        setLoadProgress({ done, total })
      })
      setStatsMap(map)
    } finally {
      setRankLoading(false)
      setLoadProgress(null)
    }
  }

  // Derive available race types and categories from loaded stats
  const { raceOptions, categoryOptions, rankingRows } = useMemo(() => {
    if (Object.keys(statsMap).length === 0) return { raceOptions: [], categoryOptions: [], rankingRows: [] }

    // Flatten all results from this event
    const allRows = []
    for (const [key, s] of Object.entries(statsMap)) {
      const records = (s.records ?? []).filter(r => r.event_dir === selectedEvent?.dir)
      const athlete = athletes.find(a => a.key === key)
      for (const rec of records) {
        for (const res of rec.results ?? []) {
          if (!res.time) continue
          const m = res.event?.match(/^(\d+)m\s+(.+)$/)
          if (!m) continue
          allRows.push({
            key,
            athleteInfo: athlete,
            distance: parseInt(m[1]),
            style: m[2],
            raceKey: `${m[2]}||${m[1]}`,
            time: res.time.replace("'", ':'),
            position: res.position,
            category: res.category,
          })
        }
      }
    }

    const raceSet = new Set(allRows.map(r => r.raceKey))
    const raceOpts = Array.from(raceSet).sort((a, b) => {
      const [styleA, distA] = a.split('||')
      const [styleB, distB] = b.split('||')
      return styleA.localeCompare(styleB) || parseInt(distA) - parseInt(distB)
    }).map(k => {
      const [style, dist] = k.split('||')
      return { value: k, label: `${dist}m ${style}` }
    })

    const filtered = racePick
      ? allRows.filter(r => r.raceKey === racePick)
      : allRows

    const catSet = new Set(filtered.map(r => r.category).filter(Boolean))
    const catOpts = Array.from(catSet).sort()

    const final = filtered
      .filter(r => !gender || (gender === 'M' ? r.category?.toLowerCase().includes('masch') : r.category?.toLowerCase().includes('femm')))
      .filter(r => !categoryPick || r.category === categoryPick)
      .sort((a, b) => parseTimeToSeconds(a.time) - parseTimeToSeconds(b.time))

    return { raceOptions: raceOpts, categoryOptions: catOpts, rankingRows: final }
  }, [statsMap, racePick, gender, categoryPick, selectedEvent, athletes])

  const currentSeason = (() => {
    const n = new Date()
    const y = n.getFullYear()
    return n.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`
  })()

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Classifiche</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: 4 }}>
          Seleziona una competizione per vedere la classifica per specialità
        </p>
      </div>

      {/* Year + event filters */}
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>Stagione</label>
            <select className="filter-select" style={{ width: '100%' }} value={year} onChange={e => setYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Competition list */}
        {eventsLoading ? (
          <div className="loading-center" style={{ padding: 16 }}>
            <span className="spinner spinner--sm" />
          </div>
        ) : (
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 6 }}>
              Competizione ({events.length})
            </label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              {events.length === 0 ? (
                <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Nessuna competizione disponibile per {year}.
                </div>
              ) : events.map(ev => (
                <button
                  key={ev.dir}
                  onClick={() => loadRanking(ev)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', borderBottom: '1px solid var(--border)',
                    background: selectedEvent?.dir === ev.dir ? 'var(--primary-light)' : 'transparent',
                    color: selectedEvent?.dir === ev.dir ? 'var(--primary)' : 'var(--text)',
                    fontWeight: selectedEvent?.dir === ev.dir ? 700 : 400,
                    fontSize: '0.85rem', cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{ev.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatDateLocal(parseDate(ev.date))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading progress */}
      {rankLoading && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
            Caricamento dati atleti…
          </div>
          {loadProgress && (
            <>
              <div style={{ background: 'var(--border)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: 'var(--primary)', borderRadius: 999,
                  width: `${(loadProgress.done / loadProgress.total) * 100}%`,
                  transition: 'width 0.2s',
                }} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                {loadProgress.done} / {loadProgress.total} atleti
              </div>
            </>
          )}
        </div>
      )}

      {/* Ranking filters */}
      {!rankLoading && selectedEvent && Object.keys(statsMap).length > 0 && (
        <>
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>Gara</label>
              <select className="filter-select" style={{ width: '100%' }} value={racePick} onChange={e => setRacePick(e.target.value)}>
                <option value="">Tutte le gare</option>
                {raceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>Genere</label>
                <div className="seg-ctrl">
                  <button className={`seg-btn${gender === '' ? ' active' : ''}`} onClick={() => setGender('')}>Tutti</button>
                  <button className={`seg-btn${gender === 'M' ? ' active' : ''}`} onClick={() => setGender('M')}>M</button>
                  <button className={`seg-btn${gender === 'F' ? ' active' : ''}`} onClick={() => setGender('F')}>F</button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>Categoria</label>
                <select className="filter-select" style={{ width: '100%' }} value={categoryPick} onChange={e => setCategoryPick(e.target.value)}>
                  <option value="">Tutte</option>
                  {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Ranking table */}
          <div>
            <div className="section-header">
              <h2 className="section-title">
                {racePick ? raceOptions.find(o => o.value === racePick)?.label : 'Tutte le gare'}
              </h2>
              <span className="pill">{rankingRows.length} atleti</span>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {rankingRows.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🔍</span>
                  <p>Nessun risultato con i filtri selezionati.</p>
                </div>
              ) : (
                rankingRows.map((row, i) => {
                  const sw = row.athleteInfo ? toSwimmer(row.athleteInfo) : null
                  const accentColor = STYLE_HUE[row.style] || 'var(--primary)'
                  return (
                    <div
                      key={`${row.key}-${row.style}-${row.distance}-${i}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        borderBottom: i < rankingRows.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onClick={() => navigate(`/athlete/${encodeURIComponent(row.key)}`)}
                    >
                      <div className={`rank-badge ${rankLabel(i)}`} style={{ minWidth: 32, fontSize: '0.78rem' }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sw?.displayName ?? row.key}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sw?.club} · {sw?.birthYear}
                        </div>
                        {!racePick && (
                          <div style={{ fontSize: '0.72rem', color: accentColor, fontWeight: 600 }}>
                            {row.distance}m {row.style}
                          </div>
                        )}
                      </div>
                      <span className="time-mono" style={{ fontSize: '1rem', color: accentColor }}>
                        {formatTime(row.time)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* No competition selected */}
      {!rankLoading && !selectedEvent && (
        <div className="empty-state">
          <span className="empty-icon">🏆</span>
          <p>Seleziona una competizione per vedere la classifica.</p>
        </div>
      )}
    </div>
  )
}
