import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchAthletes, getAthleteStats } from '../api'
import { toSwimmer, toResults, getBestTimes, formatTime, parseTimeToSeconds } from '../utils'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function AthleteSearch({ label, value, onChange, onSelect }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const debouncedQ = useDebounce(query, 180)

  useEffect(() => {
    if (debouncedQ.trim().length < 2) { setSuggestions([]); return }
    setLoading(true)
    searchAthletes(debouncedQ)
      .then(d => { setSuggestions(d); setOpen(true) })
      .finally(() => setLoading(false))
  }, [debouncedQ])

  function select(a) {
    const sw = toSwimmer(a)
    setQuery(sw.displayName)
    setSuggestions([])
    setOpen(false)
    onSelect(a)
  }

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <div className="search-wrap">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          style={{ fontSize: '0.9rem', padding: '10px 10px 10px 38px' }}
          type="search"
          placeholder="Cerca nuotatore…"
          value={value ? toSwimmer(value).displayName : query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null) }}
          autoComplete="off"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto', marginTop: 4,
        }}>
          {suggestions.map(a => {
            const sw = toSwimmer(a)
            return (
              <div key={a.key} className="athlete-row" onClick={() => select(a)}>
                <div className="athlete-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>{sw.initials}</div>
                <div className="athlete-info">
                  <div className="athlete-name" style={{ fontSize: '0.85rem' }}>{sw.displayName}</div>
                  <div className="athlete-meta">{sw.club} · {sw.birthYear}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Compare() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [athleteA, setAthleteA] = useState(null)
  const [athleteB, setAthleteB] = useState(null)
  const [statsA, setStatsA] = useState(null)
  const [statsB, setStatsB] = useState(null)
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)

  // Pre-fill from URL param ?a=key
  useEffect(() => {
    const aKey = searchParams.get('a')
    if (aKey && !athleteA) {
      getAthleteStats(aKey).then(s => {
        setAthleteA({ key: s.key, name: s.name, year_of_birth: s.year_of_birth, sex: s.sex, society: s.society })
        setStatsA(s)
      }).catch(() => {})
    }
  }, [searchParams])

  useEffect(() => {
    if (!athleteA) { setStatsA(null); return }
    setLoadingA(true)
    getAthleteStats(athleteA.key)
      .then(s => { setStatsA(s); setLoadingA(false) })
      .catch(() => setLoadingA(false))
  }, [athleteA])

  useEffect(() => {
    if (!athleteB) { setStatsB(null); return }
    setLoadingB(true)
    getAthleteStats(athleteB.key)
      .then(s => { setStatsB(s); setLoadingB(false) })
      .catch(() => setLoadingB(false))
  }, [athleteB])

  const comparison = useMemo(() => {
    if (!statsA || !statsB) return []
    const bestA = {}
    getBestTimes(toResults(statsA)).forEach(r => { bestA[`${r.style}||${r.distance}`] = r })
    const bestB = {}
    getBestTimes(toResults(statsB)).forEach(r => { bestB[`${r.style}||${r.distance}`] = r })
    const allKeys = new Set([...Object.keys(bestA), ...Object.keys(bestB)])
    return Array.from(allKeys).sort((a, b) => {
      const [sA, dA] = a.split('||')
      const [sB, dB] = b.split('||')
      return sA.localeCompare(sB) || parseInt(dA) - parseInt(dB)
    }).map(k => {
      const [style, dist] = k.split('||')
      const ra = bestA[k] ?? null
      const rb = bestB[k] ?? null
      const secsA = parseTimeToSeconds(ra?.time)
      const secsB = parseTimeToSeconds(rb?.time)
      let winner = null
      if (ra && rb) winner = secsA < secsB ? 'A' : secsA > secsB ? 'B' : 'tie'
      return { style, distance: parseInt(dist), ra, rb, winner }
    })
  }, [statsA, statsB])

  const swA = athleteA ? toSwimmer(athleteA) : null
  const swB = athleteB ? toSwimmer(athleteB) : null

  const winsA = comparison.filter(r => r.winner === 'A').length
  const winsB = comparison.filter(r => r.winner === 'B').length

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Confronta</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: 4 }}>
          Affianca i primati personali di due nuotatori
        </p>
      </div>

      {/* Athlete selectors */}
      <div style={{ display: 'flex', gap: 10 }}>
        <AthleteSearch label="Nuotatore A" value={athleteA} onChange={setAthleteA} onSelect={setAthleteA} />
        <AthleteSearch label="Nuotatore B" value={athleteB} onChange={setAthleteB} onSelect={setAthleteB} />
      </div>

      {/* Header summary */}
      {swA && swB && (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#DBEAFE', color: '#1D4ED8', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>{swA.initials}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>{swA.firstName}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{swA.birthYear}</div>
              <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#1D4ED8', marginTop: 4 }}>{winsA}</div>
            </div>
            <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>VS</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FCE7F3', color: '#BE185D', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>{swB.initials}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>{swB.firstName}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{swB.birthYear}</div>
              <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#BE185D', marginTop: 4 }}>{winsB}</div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {(loadingA || loadingB) && (
        <div className="loading-center" style={{ padding: 24 }}>
          <span className="spinner" />
          <p>Caricamento dati…</p>
        </div>
      )}

      {/* Comparison table */}
      {!loadingA && !loadingB && comparison.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {comparison.map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr',
              padding: '10px 12px', gap: 8, alignItems: 'center',
              borderBottom: i < comparison.length - 1 ? '1px solid var(--border)' : 'none',
              background: row.winner === 'A' ? '#EFF6FF' : row.winner === 'B' ? '#FDF2F8' : 'transparent',
            }}>
              <div style={{ textAlign: 'right' }}>
                {row.ra ? (
                  <span className="time-mono" style={{ fontSize: '0.95rem', color: row.winner === 'A' ? '#1D4ED8' : 'var(--text)' }}>
                    {formatTime(row.ra.time)}
                    {row.winner === 'A' && <span style={{ marginLeft: 4 }}>✓</span>}
                  </span>
                ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>}
              </div>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sub)' }}>{row.distance}m</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{row.style}</div>
              </div>
              <div>
                {row.rb ? (
                  <span className="time-mono" style={{ fontSize: '0.95rem', color: row.winner === 'B' ? '#BE185D' : 'var(--text)' }}>
                    {row.winner === 'B' && <span style={{ marginRight: 4 }}>✓</span>}
                    {formatTime(row.rb.time)}
                  </span>
                ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No athletes selected */}
      {!athleteA && !athleteB && (
        <div className="empty-state">
          <span className="empty-icon">⚖️</span>
          <p>Cerca due nuotatori per confrontare i loro primati personali.</p>
        </div>
      )}
    </div>
  )
}
