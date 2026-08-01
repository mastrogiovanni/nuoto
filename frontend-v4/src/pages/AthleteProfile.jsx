import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAthleteStats } from '../api'
import { toSwimmer, toResults, getBestTimes, formatTime, formatDateLocal, parseTimeToSeconds, rankLabel } from '../utils'
import { useFavorites } from '../context/FavoritesContext'

const STYLE_HUE = {
  'Stile libero': '#2563EB',
  'Dorso':        '#7C3AED',
  'Rana':         '#059669',
  'Delfino':      '#0891B2',
  'Misto':        '#B45309',
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

  const W = 320, H = 140, PAD = { top: 12, right: 16, bottom: 28, left: 40 }
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

  const color = STYLE_HUE[style] || '#2563EB'
  const [hovered, setHovered] = useState(null)

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Area fill */}
        <polygon points={areaPoints} fill="url(#chartGrad)" />

        {/* Line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Y axis label (best time) */}
        <text x={PAD.left - 4} y={yPct(minSecs)} fontSize="9" fill="var(--text-muted)" textAnchor="end" dominantBaseline="middle">
          {formatTime(data[data.findIndex(d => d.secs === minSecs)].time)}
        </text>

        {/* Data points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xPct(i)} cy={yPct(d.secs)} r={hovered === i ? 5 : 3.5}
              fill="white" stroke={color} strokeWidth="2"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            />
            {hovered === i && (
              <g>
                <rect x={xPct(i) - 30} y={yPct(d.secs) - 28} width="60" height="22" rx="4" fill={color} />
                <text x={xPct(i)} y={yPct(d.secs) - 17} fontSize="9" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="700">
                  {formatTime(d.time)}
                </text>
              </g>
            )}
          </g>
        ))}

        {/* X axis dates */}
        {data.filter((_, i) => data.length <= 6 || i % Math.ceil(data.length / 5) === 0 || i === data.length - 1).map((d, _, arr) => {
          const origIdx = data.indexOf(d)
          return (
            <text key={origIdx} x={xPct(origIdx)} y={H - PAD.bottom + 10} fontSize="8" fill="var(--text-muted)" textAnchor="middle">
              {d.date.slice(0, 7)}
            </text>
          )
        })}
      </svg>
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

  const fav = stats ? isFavorite(key) : false

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAthleteStats(key)
      .then(data => { setStats(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [key])

  const swimmer = useMemo(() => stats ? toSwimmer(stats) : null, [stats])
  const results = useMemo(() => stats ? toResults(stats) : [], [stats])
  const bestTimes = useMemo(() => getBestTimes(results), [results])
  const recentResults = useMemo(() => results.slice(0, 15), [results])

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
        <button onClick={() => navigate(-1)} style={{ marginTop: 8, color: 'var(--primary)', fontWeight: 600 }}>← Torna indietro</button>
      </div>
    </div>
  )

  const chartStyle = chartEvent ? chartEvent.split('||')[0] : null
  const chartDist = chartEvent ? parseInt(chartEvent.split('||')[1]) : null

  return (
    <div className="page" style={{ paddingTop: 12 }}>
      {/* Back */}
      <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', alignSelf: 'flex-start' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Indietro
      </button>

      {/* Profile header */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'var(--primary-light)', color: 'var(--primary)',
            fontSize: '1.3rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {swimmer.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{swimmer.displayName}</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', margin: '2px 0 0' }}>
              {swimmer.club}
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="pill pill--muted">Nato/a {swimmer.birthYear}</span>
              <span className="pill pill--muted">{swimmer.sex === 'M' ? 'Maschile' : 'Femminile'}</span>
              <span className="pill pill--muted">{bestTimes.length} specialità</span>
            </div>
          </div>
          <button className="fav-btn" onClick={toggleFav} title={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'} style={{ fontSize: '1.5rem' }}>
            {fav ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      {/* Tab switch */}
      <div className="seg-ctrl">
        <button className={`seg-btn${tab === 'bests' ? ' active' : ''}`} onClick={() => setTab('bests')}>
          Primati
        </button>
        <button className={`seg-btn${tab === 'recent' ? ' active' : ''}`} onClick={() => setTab('recent')}>
          Gare recenti
        </button>
        <button className={`seg-btn${tab === 'chart' ? ' active' : ''}`} onClick={() => setTab('chart')}>
          Progressione
        </button>
      </div>

      {/* Tab content */}
      {tab === 'bests' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {bestTimes.length === 0 ? (
            <div className="empty-state"><p>Nessun primato personale disponibile.</p></div>
          ) : (
            bestTimes.map((r, i) => (
              <div key={`${r.style}-${r.distance}`} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < bestTimes.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div className={`rank-badge ${rankLabel(i)}`}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: STYLE_HUE[r.style] || 'var(--primary)' }}>
                    {r.style}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {r.distance}m · {formatDateLocal(r.date)}
                  </div>
                </div>
                <span className="time-mono">{formatTime(r.time)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'recent' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {recentResults.length === 0 ? (
            <div className="empty-state"><p>Nessuna gara recente disponibile.</p></div>
          ) : (
            recentResults.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < recentResults.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div className={`rank-badge${r.position === 1 ? ' rank-badge--gold' : r.position === 2 ? ' rank-badge--silver' : r.position === 3 ? ' rank-badge--bronze' : ''}`} style={{ minWidth: 30, fontSize: '0.72rem' }}>
                  {r.position ? `${r.position}°` : '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: STYLE_HUE[r.style] || 'var(--text)' }}>
                    {r.distance}m {r.style}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.competition}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatDateLocal(r.date)}
                  </div>
                </div>
                <span className="time-mono" style={{ fontSize: '0.95rem' }}>{formatTime(r.time)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'chart' && (
        <>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 6 }}>
              Seleziona specialità
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
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
            <div className="card" style={{ padding: '16px 8px 8px' }}>
              <div style={{ paddingLeft: 8, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: STYLE_HUE[chartStyle] || 'var(--primary)' }}>
                  {chartDist}m {chartStyle}
                </span>
                <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  — Progressione nel tempo
                </span>
              </div>
              <ProgressionChart results={results} style={chartStyle} distance={chartDist} />
            </div>
          )}
        </>
      )}

      {/* Compare shortcut */}
      <button
        onClick={() => navigate(`/compare?a=${encodeURIComponent(key)}`)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px', borderRadius: 'var(--radius-lg)',
          background: 'var(--primary)', color: 'white',
          fontWeight: 700, fontSize: '0.9rem',
          border: 'none', cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
        Confronta con un altro nuotatore
      </button>
    </div>
  )
}
