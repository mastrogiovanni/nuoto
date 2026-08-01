import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAthleteStats } from '../api'
import { toSwimmer, toResults, getBestTimes, formatTime, formatDateLocal, parseTimeToSeconds, rankLabel } from '../utils'
import { useFavorites } from '../context/FavoritesContext'

const STYLE_COLOR = {
  'Stile libero': '#005F8A',
  'Dorso':        '#7C3AED',
  'Rana':         '#059669',
  'Delfino':      '#0891B2',
  'Misto':        '#D97706',
}

function ProgressionChart({ results, style, distance }) {
  const data = useMemo(() => {
    return results
      .filter(r => r.style === style && r.distance === distance && r.time)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ date: r.date, secs: parseTimeToSeconds(r.time), time: r.time, comp: r.competition }))
  }, [results, style, distance])

  if (data.length < 2) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Servono almeno 2 gare per il grafico di progressione.
      </div>
    )
  }

  const W = 320, H = 150, PAD = { top: 14, right: 16, bottom: 30, left: 44 }
  const minSecs = Math.min(...data.map(d => d.secs))
  const maxSecs = Math.max(...data.map(d => d.secs))
  const range = maxSecs - minSecs || 1

  function xPct(i) { return PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right) }
  function yPct(s) { return PAD.top + (1 - (s - minSecs) / range) * (H - PAD.top - PAD.bottom) }

  const points = data.map((d, i) => `${xPct(i)},${yPct(d.secs)}`).join(' ')
  const areaPoints = [
    `${xPct(0)},${H - PAD.bottom}`,
    ...data.map((d, i) => `${xPct(i)},${yPct(d.secs)}`),
    `${xPct(data.length - 1)},${H - PAD.bottom}`,
  ].join(' ')

  const color = STYLE_COLOR[style] || '#005F8A'
  const [hovered, setHovered] = useState(null)

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="chartGrad5" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>

        <polygon points={areaPoints} fill="url(#chartGrad5)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Best time label */}
        <text x={PAD.left - 5} y={yPct(minSecs)} fontSize="9" fill="var(--text-muted)" textAnchor="end" dominantBaseline="middle">
          {formatTime(data[data.findIndex(d => d.secs === minSecs)].time)}
        </text>

        {/* Worst time label */}
        <text x={PAD.left - 5} y={yPct(maxSecs)} fontSize="9" fill="var(--text-muted)" textAnchor="end" dominantBaseline="middle">
          {formatTime(data[data.findIndex(d => d.secs === maxSecs)].time)}
        </text>

        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xPct(i)} cy={yPct(d.secs)} r={hovered === i ? 5.5 : 4}
              fill="white" stroke={color} strokeWidth="2"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            />
            {hovered === i && (
              <g>
                <rect
                  x={Math.min(xPct(i) - 32, W - 68)} y={yPct(d.secs) - 32}
                  width="64" height="24" rx="5" fill={color}
                />
                <text
                  x={Math.min(xPct(i), W - 36)} y={yPct(d.secs) - 20}
                  fontSize="10" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="700"
                >
                  {formatTime(d.time)}
                </text>
              </g>
            )}
          </g>
        ))}

        {data
          .filter((_, i) => data.length <= 6 || i % Math.ceil(data.length / 5) === 0 || i === data.length - 1)
          .map(d => {
            const origIdx = data.indexOf(d)
            return (
              <text key={origIdx} x={xPct(origIdx)} y={H - PAD.bottom + 12} fontSize="8" fill="var(--text-muted)" textAnchor="middle">
                {d.date.slice(0, 7)}
              </text>
            )
          })}
      </svg>
    </div>
  )
}

function SplitsPanel({ splits }) {
  if (!splits || splits.length < 2) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div className="splits-table" style={{ background: 'var(--surface-alt)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '4px 8px', fontWeight: 700, fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--border)' }}>m</div>
        <div style={{ padding: '4px 8px', fontWeight: 700, fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--border)', textAlign: 'center' }}>Parziale</div>
        <div style={{ padding: '4px 8px', fontWeight: 700, fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--border)', textAlign: 'right' }}>Totale</div>
        {splits.map((sp, idx) => {
          const prev = idx > 0 ? splits[idx - 1] : null
          const segSecs = prev
            ? parseTimeToSeconds(sp.time) - parseTimeToSeconds(prev.time)
            : parseTimeToSeconds(sp.time)
          const segMins = Math.floor(segSecs / 60)
          const segRem = (segSecs % 60).toFixed(2).padStart(5, '0')
          const segFmt = segMins > 0 ? `${segMins}'${segRem}` : segSecs.toFixed(2)
          return [
            <div key={`m${idx}`} style={{ padding: '4px 8px', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-sub)' }}>{sp.metres}</div>,
            <div key={`p${idx}`} style={{ padding: '4px 8px', fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{segFmt}''</div>,
            <div key={`t${idx}`} style={{ padding: '4px 8px', fontSize: '0.78rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{formatTime(sp.time)}</div>,
          ]
        })}
      </div>
    </div>
  )
}

export default function AthleteProfile() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('bests') // bests | recent | chart
  const [chartEvent, setChartEvent] = useState(null)
  const [expandedResult, setExpandedResult] = useState(null) // id of expanded result

  const fav = stats ? isFavorite(key) : false

  useEffect(() => {
    setLoading(true)
    setError(null)
    setStats(null)
    getAthleteStats(key)
      .then(data => { setStats(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [key])

  const swimmer = useMemo(() => stats ? toSwimmer(stats) : null, [stats])
  const results = useMemo(() => stats ? toResults(stats) : [], [stats])
  const bestTimes = useMemo(() => getBestTimes(results), [results])
  const recentResults = useMemo(() => results.slice(0, 20), [results])

  useEffect(() => {
    if (bestTimes.length > 0 && !chartEvent) {
      setChartEvent(`${bestTimes[0].style}||${bestTimes[0].distance}`)
    }
  }, [bestTimes])

  function toggleFav() {
    if (fav) removeFavorite(key)
    else addFavorite(swimmer)
  }

  if (loading) return (
    <div className="loading-center" style={{ minHeight: '60vh' }}>
      <span className="spinner" />
      <p>Caricamento profilo…</p>
    </div>
  )

  if (error) return (
    <div className="page">
      <div className="empty-state">
        <span className="empty-icon">⚠️</span>
        <p>Errore: {error}</p>
        <button onClick={() => navigate(-1)} className="btn-ghost" style={{ marginTop: 8 }}>← Torna indietro</button>
      </div>
    </div>
  )

  const chartStyle = chartEvent ? chartEvent.split('||')[0] : null
  const chartDist = chartEvent ? parseInt(chartEvent.split('||')[1]) : null

  return (
    <div className="page" style={{ paddingTop: 12 }}>
      {/* Back */}
      <button onClick={() => navigate(-1)} className="btn-ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Indietro
      </button>

      {/* Profile header */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--primary-light)', color: 'var(--primary)',
            fontSize: '1.4rem', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, letterSpacing: '-0.02em',
          }}>
            {swimmer.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>{swimmer.displayName}</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', margin: '3px 0 8px' }}>
              {swimmer.club}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="pill pill--muted">Nato/a {swimmer.birthYear}</span>
              <span className="pill pill--muted">{swimmer.sex === 'M' ? 'Maschile' : 'Femminile'}</span>
              <span className="pill pill--accent">{bestTimes.length} specialità</span>
            </div>
          </div>
          <button
            className="fav-btn"
            onClick={toggleFav}
            title={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            style={{ fontSize: '1.5rem' }}
          >
            {fav ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tab-bar">
          <button className={`tab-btn${tab === 'bests' ? ' active' : ''}`} onClick={() => setTab('bests')}>
            Primati personali
          </button>
          <button className={`tab-btn${tab === 'recent' ? ' active' : ''}`} onClick={() => setTab('recent')}>
            Gare recenti
          </button>
          <button className={`tab-btn${tab === 'chart' ? ' active' : ''}`} onClick={() => setTab('chart')}>
            Progressione
          </button>
        </div>

        {/* Tab: Personal bests */}
        {tab === 'bests' && (
          bestTimes.length === 0 ? (
            <div className="empty-state"><p>Nessun primato disponibile.</p></div>
          ) : (
            bestTimes.map((r, i) => (
              <div key={`${r.style}-${r.distance}`} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < bestTimes.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div className={`rank-badge ${rankLabel(i)}`} style={{ fontSize: '0.72rem' }}>{i + 1}</div>
                <div
                  style={{ width: 10, height: 10, borderRadius: '50%', background: STYLE_COLOR[r.style] || 'var(--primary)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: STYLE_COLOR[r.style] || 'var(--primary)' }}>
                    {r.distance}m {r.style}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {formatDateLocal(r.date)} · {r.category}
                  </div>
                </div>
                <span className="time-mono">{formatTime(r.time)}</span>
              </div>
            ))
          )
        )}

        {/* Tab: Recent races */}
        {tab === 'recent' && (
          recentResults.length === 0 ? (
            <div className="empty-state"><p>Nessuna gara recente disponibile.</p></div>
          ) : (
            recentResults.map((r, i) => (
              <div key={r.id}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: (i < recentResults.length - 1 && expandedResult !== r.id)
                      ? '1px solid var(--border)' : 'none',
                    cursor: r.splits?.length > 0 ? 'pointer' : 'default',
                    background: expandedResult === r.id ? 'var(--surface-alt)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => {
                    if (r.splits?.length > 0) {
                      setExpandedResult(expandedResult === r.id ? null : r.id)
                    }
                  }}
                >
                  <div className={`rank-badge${r.position === 1 ? ' rank-badge--gold' : r.position === 2 ? ' rank-badge--silver' : r.position === 3 ? ' rank-badge--bronze' : ''}`}
                    style={{ minWidth: 30, fontSize: '0.72rem' }}>
                    {r.position ? `${r.position}°` : '—'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: STYLE_COLOR[r.style] || 'var(--text)' }}>
                      {r.distance}m {r.style}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.competition}
                    </div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                      {formatDateLocal(r.date)} · {r.category}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span className="time-mono" style={{ fontSize: '0.95rem' }}>{formatTime(r.time)}</span>
                    {r.splits?.length > 0 && (
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ color: 'var(--text-muted)', transform: expandedResult === r.id ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    )}
                  </div>
                </div>
                {expandedResult === r.id && r.splits?.length > 0 && (
                  <div style={{ padding: '0 16px 12px', borderBottom: i < recentResults.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <SplitsPanel splits={r.splits} />
                  </div>
                )}
              </div>
            ))
          )
        )}

        {/* Tab: Progression chart */}
        {tab === 'chart' && (
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <span className="filter-label">Specialità</span>
              <select
                className="filter-select"
                value={chartEvent || ''}
                onChange={e => setChartEvent(e.target.value)}
              >
                {bestTimes.map(r => (
                  <option key={`${r.style}||${r.distance}`} value={`${r.style}||${r.distance}`}>
                    {r.distance}m {r.style}
                  </option>
                ))}
              </select>
            </div>
            {chartStyle && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: STYLE_COLOR[chartStyle] || 'var(--primary)' }}>
                    {chartDist}m {chartStyle}
                  </span>
                  <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    — curva di miglioramento
                  </span>
                </div>
                <ProgressionChart results={results} style={chartStyle} distance={chartDist} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Compare CTA */}
      <button
        onClick={() => navigate(`/compare?a=${encodeURIComponent(key)}`)}
        className="btn-primary"
        style={{ background: 'var(--top-bar)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
        Confronta con un altro nuotatore
      </button>
    </div>
  )
}
