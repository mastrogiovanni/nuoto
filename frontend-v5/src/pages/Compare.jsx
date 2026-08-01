import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchAthletes, getAthleteStats } from '../api'
import { toSwimmer, toResults, getBestTimes, formatTime, parseTimeToSeconds } from '../utils'

const STYLE_COLOR = {
  'Stile libero': '#005F8A',
  'Dorso':        '#7C3AED',
  'Rana':         '#059669',
  'Delfino':      '#0891B2',
  'Misto':        '#D97706',
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function AthleteSearch({ label, value, onChange, onSelect, accentColor }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const debouncedQ = useDebounce(query, 180)

  useEffect(() => {
    if (debouncedQ.trim().length < 2) { setSuggestions([]); return }
    setLoading(true)
    searchAthletes(debouncedQ)
      .then(d => { setSuggestions(d); setOpen(true) })
      .finally(() => setLoading(false))
  }, [debouncedQ])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function select(a) {
    const sw = toSwimmer(a)
    setQuery(sw.displayName)
    setSuggestions([])
    setOpen(false)
    onSelect(a)
  }

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }} ref={wrapRef}>
      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: accentColor, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <div className="search-wrap">
        {loading
          ? <span className="spinner spinner--sm" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          : <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
        }
        <input
          className="search-input"
          style={{ fontSize: '0.88rem', padding: '10px 10px 10px 38px', borderColor: accentColor + '60' }}
          type="search"
          placeholder="Cerca nuotatore…"
          value={value ? toSwimmer(value).displayName : query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null) }}
          autoComplete="off"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
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
      const diffMs = ra && rb ? Math.abs(secsA - secsB) : null
      return { style, distance: parseInt(dist), ra, rb, winner, diffSecs: diffMs }
    })
  }, [statsA, statsB])

  const swA = athleteA ? toSwimmer(athleteA) : null
  const swB = athleteB ? toSwimmer(athleteB) : null
  const winsA = comparison.filter(r => r.winner === 'A').length
  const winsB = comparison.filter(r => r.winner === 'B').length
  const ties = comparison.filter(r => r.winner === 'tie').length

  const COLOR_A = '#0369A1'
  const COLOR_B = '#BE185D'

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Confronta</h1>
        <p className="page-subtitle">Affianca i primati personali di due nuotatori</p>
      </div>

      {/* Athlete selectors */}
      <div style={{ display: 'flex', gap: 10 }}>
        <AthleteSearch label="Nuotatore A" value={athleteA} onChange={setAthleteA} onSelect={setAthleteA} accentColor={COLOR_A} />
        <AthleteSearch label="Nuotatore B" value={athleteB} onChange={setAthleteB} onSelect={setAthleteB} accentColor={COLOR_B} />
      </div>

      {/* VS card */}
      {swA && swB && (
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#DBEAFE', color: COLOR_A, fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>{swA.initials}</div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.2 }}>{swA.firstName}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{swA.birthYear}</div>
              <div style={{ fontWeight: 900, fontSize: '1.6rem', color: COLOR_A, lineHeight: 1 }}>{winsA}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>vittorie</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '1rem' }}>VS</span>
              {ties > 0 && <span className="pill pill--muted" style={{ fontSize: '0.65rem' }}>{ties} parità</span>}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FCE7F3', color: COLOR_B, fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>{swB.initials}</div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.2 }}>{swB.firstName}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{swB.birthYear}</div>
              <div style={{ fontWeight: 900, fontSize: '1.6rem', color: COLOR_B, lineHeight: 1 }}>{winsB}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>vittorie</div>
            </div>
          </div>
        </div>
      )}

      {(loadingA || loadingB) && (
        <div className="loading-center" style={{ padding: 24 }}>
          <span className="spinner" />
          <p>Caricamento dati…</p>
        </div>
      )}

      {!loadingA && !loadingB && comparison.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', padding: '8px 12px', background: 'var(--border)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div style={{ textAlign: 'right', color: COLOR_A }}>{swA?.firstName}</div>
            <div style={{ textAlign: 'center' }}>Gara</div>
            <div style={{ color: COLOR_B }}>{swB?.firstName}</div>
          </div>
          {comparison.map((row, i) => {
            const styleColor = STYLE_COLOR[row.style] || 'var(--primary)'
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 1fr',
                padding: '10px 12px', gap: 4, alignItems: 'center',
                borderBottom: i < comparison.length - 1 ? '1px solid var(--border)' : 'none',
                background: row.winner === 'A' ? '#EFF8FF' : row.winner === 'B' ? '#FDF2F8' : 'transparent',
              }}>
                <div style={{ textAlign: 'right' }}>
                  {row.ra ? (
                    <span className="time-mono" style={{ fontSize: '0.95rem', color: row.winner === 'A' ? COLOR_A : 'var(--text)' }}>
                      {row.winner === 'A' && <span style={{ marginRight: 4, fontSize: '0.7rem' }}>✓</span>}
                      {formatTime(row.ra.time)}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: styleColor }}>{row.distance}m</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>{row.style}</div>
                  {row.diffSecs !== null && (
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Δ {row.diffSecs.toFixed(2)}s
                    </div>
                  )}
                </div>
                <div>
                  {row.rb ? (
                    <span className="time-mono" style={{ fontSize: '0.95rem', color: row.winner === 'B' ? COLOR_B : 'var(--text)' }}>
                      {formatTime(row.rb.time)}
                      {row.winner === 'B' && <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>✓</span>}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Shortcuts to profiles */}
      {(swA || swB) && (
        <div style={{ display: 'flex', gap: 10 }}>
          {swA && (
            <button
              onClick={() => navigate(`/athlete/${encodeURIComponent(athleteA.key)}`)}
              className="btn-ghost"
              style={{ flex: 1, justifyContent: 'center', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px' }}
            >
              Profilo {swA.firstName}
            </button>
          )}
          {swB && (
            <button
              onClick={() => navigate(`/athlete/${encodeURIComponent(athleteB.key)}`)}
              className="btn-ghost"
              style={{ flex: 1, justifyContent: 'center', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px' }}
            >
              Profilo {swB.firstName}
            </button>
          )}
        </div>
      )}

      {!athleteA && !athleteB && (
        <div className="empty-state">
          <span className="empty-icon">⚖️</span>
          <p>Cerca due nuotatori per confrontare i loro primati personali.</p>
        </div>
      )}
    </div>
  )
}
