import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getYears, getEvents, fetchEventAthletesMulti, fetchStatsBatch } from '../api'
import {
  toSwimmer, normalizeTime, formatTime, parseTimeToSeconds,
  parseDate, formatDateLocal, normalizeStyle, categoryKey,
  categoryMatchesGender, rankLabel, inferVasca,
} from '../utils'
import { useFavorites } from '../context/FavoritesContext'

const STYLE_COLOR = {
  'Stile libero': '#005F8A',
  'Dorso':        '#7C3AED',
  'Rana':         '#059669',
  'Delfino':      '#0891B2',
  'Misto':        '#D97706',
}

const STYLE_OPTIONS = ['Stile libero', 'Dorso', 'Rana', 'Delfino', 'Misto']

const DISTANCES_BY_STYLE = {
  'Stile libero': [50, 100, 200, 400, 800, 1500],
  'Dorso':        [50, 100, 200],
  'Rana':         [50, 100, 200],
  'Delfino':      [50, 100, 200],
  'Misto':        [100, 200, 400],
}

const CATEGORIES = ['', 'Esordienti B', 'Esordienti A', 'Ragazzi', 'Juniores', 'Cadetti', 'Seniores', 'Assoluti', 'Masters']

function styleMatches(apiStyle, filterStyle) {
  const norm = normalizeStyle(apiStyle)
  if (filterStyle === 'Delfino') return norm === 'Delfino'
  return norm === filterStyle
}

export default function Ranking() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addWatchedRace } = useFavorites()

  // Filters
  const [years, setYears] = useState([])
  const [season, setSeason] = useState('')
  const [style, setStyle] = useState('Stile libero')
  const [distance, setDistance] = useState(100)
  const [gender, setGender] = useState('M')
  const [category, setCategory] = useState('')
  const [vasca, setVasca] = useState('')

  // Loading state
  const [phase, setPhase] = useState('') // '' | 'events' | 'athletes' | 'stats'
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [rankingRows, setRankingRows] = useState(null) // null = not generated yet
  const [error, setError] = useState('')
  const [savedConfirm, setSavedConfirm] = useState(false)

  const loading = phase !== ''

  useEffect(() => {
    getYears().then(y => {
      const sorted = [...y].sort().reverse()
      setYears(sorted)
      if (sorted.length > 0) setSeason(sorted[0])
    })
  }, [])

  // Sync distance when style changes
  useEffect(() => {
    const opts = DISTANCES_BY_STYLE[style] ?? [100]
    if (!opts.includes(distance)) setDistance(opts[0])
  }, [style])

  // Pre-fill from URL params if redirected from elsewhere
  useEffect(() => {
    const s = searchParams.get('style')
    const d = parseInt(searchParams.get('distance') || '0')
    const g = searchParams.get('gender')
    const c = searchParams.get('category')
    const yr = searchParams.get('season')
    if (s && STYLE_OPTIONS.includes(s)) setStyle(s)
    if (d && DISTANCES_BY_STYLE[s ?? style]?.includes(d)) setDistance(d)
    if (g === 'M' || g === 'F') setGender(g)
    if (c) setCategory(c)
    if (yr) setSeason(yr)
  }, [])

  async function generateRanking() {
    if (!season) return
    setError('')
    setRankingRows(null)

    try {
      // Phase 1: load all events for the season
      setPhase('events')
      setProgress({ done: 0, total: 1 })
      const events = await getEvents(season)
      setProgress({ done: 1, total: 1 })

      if (events.length === 0) {
        setRankingRows([])
        setPhase('')
        return
      }

      // Phase 2: load athlete lists for all events
      setPhase('athletes')
      setProgress({ done: 0, total: events.length })
      const athleteMap = await fetchEventAthletesMulti(
        season,
        events.map(e => e.dir),
        (done, total) => setProgress({ done, total })
      )

      const keys = Object.keys(athleteMap)
      if (keys.length === 0) {
        setRankingRows([])
        setPhase('')
        return
      }

      // Phase 3: load stats for all athletes
      setPhase('stats')
      setProgress({ done: 0, total: keys.length })
      const statsMap = await fetchStatsBatch(keys, (done, total) => {
        setProgress({ done, total })
      })

      // Phase 4: compile ranking — best time per athlete for the selected event
      const bestByAthlete = {}
      for (const [key, stats] of Object.entries(statsMap)) {
        for (const record of stats.records ?? []) {
          if (record.year !== season) continue
          for (const result of record.results ?? []) {
            if (!result.time) continue
            const m = result.event?.match(/^(\d+)m\s+(.+)$/)
            if (!m) continue
            const dist = parseInt(m[1])
            const st = m[2]
            if (dist !== distance || !styleMatches(st, style)) continue

            const cat = result.category ?? ''
            if (!categoryMatchesGender(cat, gender)) continue
            if (category && categoryKey(cat) !== category) continue

            // Vasca filter: heuristic on competition name
            if (vasca) {
              const ev = inferVasca(record.competition)
              if (ev && ev !== vasca) continue
            }

            const normTime = normalizeTime(result.time)
            const secs = parseTimeToSeconds(normTime)
            const existing = bestByAthlete[key]
            if (!existing || secs < existing.secs) {
              const ath = athleteMap[key] ?? { key, name: stats.name, year_of_birth: stats.year_of_birth, sex: stats.sex, society: stats.society }
              bestByAthlete[key] = {
                key,
                swimmer: toSwimmer(ath),
                time: normTime,
                secs,
                category: cat,
                competition: record.competition,
                date: parseDate(record.date),
                position: result.position,
              }
            }
          }
        }
      }

      const ranked = Object.values(bestByAthlete).sort((a, b) => a.secs - b.secs)
      setRankingRows(ranked)
    } catch (e) {
      setError(e.message || 'Errore durante il caricamento')
    } finally {
      setPhase('')
    }
  }

  function saveToWatchlist() {
    const id = `${season}-${style}-${distance}-${gender}-${category}`
    addWatchedRace({
      id,
      label: `${distance}m ${style}${category ? ' · ' + category : ''} (${gender === 'M' ? 'Maschile' : 'Femminile'}) · ${season}`,
      season,
      style,
      distance,
      gender,
      category,
      vasca,
    })
    setSavedConfirm(true)
    setTimeout(() => setSavedConfirm(false), 2000)
  }

  const phaseLabel = {
    events: 'Caricamento competizioni…',
    athletes: 'Caricamento atleti…',
    stats: 'Caricamento statistiche…',
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Classifica</h1>
        <p className="page-subtitle">Genera la graduatoria stagionale per specialità</p>
      </div>

      {/* ── Filters card ── */}
      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Stagione */}
        <div>
          <span className="filter-label">Stagione</span>
          <select className="filter-select" value={season} onChange={e => setSeason(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Gara */}
        <div>
          <span className="filter-label">Stile</span>
          <div className="seg-ctrl">
            {STYLE_OPTIONS.map(s => (
              <button key={s} className={`seg-btn${style === s ? ' active' : ''}`} onClick={() => setStyle(s)}>
                {s === 'Stile libero' ? 'SL' : s === 'Delfino' ? 'Del' : s.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="filter-label">Distanza</span>
          <div className="seg-ctrl">
            {(DISTANCES_BY_STYLE[style] ?? []).map(d => (
              <button key={d} className={`seg-btn${distance === d ? ' active' : ''}`} onClick={() => setDistance(d)}>
                {d}m
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* Genere */}
          <div style={{ flex: 1 }}>
            <span className="filter-label">Genere</span>
            <div className="seg-ctrl">
              <button className={`seg-btn${gender === 'M' ? ' active' : ''}`} onClick={() => setGender('M')}>M</button>
              <button className={`seg-btn${gender === 'F' ? ' active' : ''}`} onClick={() => setGender('F')}>F</button>
            </div>
          </div>

          {/* Vasca */}
          <div style={{ flex: 1 }}>
            <span className="filter-label">Vasca</span>
            <div className="seg-ctrl">
              <button className={`seg-btn${vasca === '' ? ' active' : ''}`} onClick={() => setVasca('')}>Tutte</button>
              <button className={`seg-btn${vasca === '25' ? ' active' : ''}`} onClick={() => setVasca('25')}>25m</button>
              <button className={`seg-btn${vasca === '50' ? ' active' : ''}`} onClick={() => setVasca('50')}>50m</button>
            </div>
          </div>
        </div>

        {/* Categoria */}
        <div>
          <span className="filter-label">Categoria</span>
          <select className="filter-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Tutte le categorie</option>
            {CATEGORIES.filter(c => c).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button
          className="btn-primary"
          onClick={generateRanking}
          disabled={loading || !season}
        >
          {loading ? (
            <>
              <span className="spinner spinner--sm" style={{ borderTopColor: 'white' }} />
              {phaseLabel[phase]}
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
                <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
                <path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              </svg>
              Genera classifica
            </>
          )}
        </button>
      </div>

      {/* Progress indicator */}
      {loading && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: 10 }}>
            {phaseLabel[phase]}
          </div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
            {progress.done} / {progress.total}
            {phase === 'stats' && progress.total > 200 && (
              <span style={{ marginLeft: 6 }}>— ci vorrà qualche istante…</span>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card" style={{ padding: 14, background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--danger)', fontWeight: 600 }}>⚠️ {error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && rankingRows !== null && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                <span style={{ color: STYLE_COLOR[style] || 'var(--primary)' }}>{distance}m {style}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {gender === 'M' ? 'Maschile' : 'Femminile'}{category ? ' · ' + category : ''}{vasca ? ' · ' + vasca + 'm' : ''} · {season}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="pill">{rankingRows.length} atleti</span>
              <button
                onClick={saveToWatchlist}
                title="Salva nei preferiti"
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: savedConfirm ? '#D1FAE5' : 'var(--primary-xlight)',
                  color: savedConfirm ? 'var(--success)' : 'var(--primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  transition: 'all 0.2s',
                }}
              >
                {savedConfirm ? '✓ Salvata' : '⭐ Salva'}
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {rankingRows.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🏊</span>
                <p>Nessun atleta trovato per i filtri selezionati.</p>
                <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Prova a cambiare categoria, genere o stagione.</p>
              </div>
            ) : (
              rankingRows.map((row, i) => {
                const color = STYLE_COLOR[style] || 'var(--primary)'
                return (
                  <div
                    key={row.key}
                    className="ranking-row"
                    onClick={() => navigate(`/athlete/${encodeURIComponent(row.key)}`)}
                  >
                    <div className={`rank-badge ${rankLabel(i)}`} style={{ minWidth: 30, fontSize: '0.75rem' }}>
                      {i + 1}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.swimmer.displayName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.swimmer.club} · {row.swimmer.birthYear}
                      </div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.competition} · {formatDateLocal(row.date)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span className="time-mono" style={{ color, fontSize: '1.05rem' }}>
                        {formatTime(row.time)}
                      </span>
                      <button
                        className="compare-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/compare?a=${encodeURIComponent(row.key)}`) }}
                        title="Confronta"
                      >
                        ⚖️ vs
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Initial state */}
      {!loading && rankingRows === null && (
        <div className="empty-state">
          <span className="empty-icon">🏆</span>
          <p>Imposta i filtri e premi <strong>Genera classifica</strong> per vedere la graduatoria stagionale.</p>
        </div>
      )}
    </div>
  )
}
