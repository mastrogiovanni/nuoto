import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { getPersonalBests, getResults, getCompetitions } from '../api'
import type { PersonalBest, RaceResult, Competition } from '../types'
import LoadingState from '../components/LoadingState'
import QualificationBadge from '../components/QualificationBadge'
import PerformanceChart, { SERIES_COLORS, type Series, type DataPoint } from '../components/PerformanceChart'
import { isQualifiedForNationals } from '../utils/qualification'
import { formatDate } from '../utils/time'

const STYLE_EMOJI: Record<string, string> = {
  'Stile Libero': '🌊',
  'Dorso':        '🔄',
  'Rana':         '🐸',
  'Delfino':      '🐬',
  'Misto':        '🔀',
}

export default function Home() {
  const { athlete, session, clearAthlete, logout } = useSession()
  const navigate = useNavigate()

  const [bests, setBests] = useState<PersonalBest[]>([])
  const [recentResults, setRecentResults] = useState<RaceResult[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)

  // Chart filters
  const [chartYear, setChartYear] = useState<string>('all')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  // All unique events from bests
  const eventOptions = useMemo(
    () => bests.map(b => ({ key: `${b.distance} ${b.style}`, label: `${b.distance}m ${b.style}` })),
    [bests],
  )

  // Available years from results
  const years = useMemo(() => {
    const ys = [...new Set(recentResults.map(r => r.year))].sort().reverse()
    return ys
  }, [recentResults])

  useEffect(() => {
    if (!athlete) { navigate('/onboarding', { replace: true }); return }
    Promise.all([
      getPersonalBests(athlete.id),
      getResults(athlete.id),
      getCompetitions(athlete.id),
    ]).then(([pb, results, comps]) => {
      setBests(pb)
      setRecentResults(results)
      setCompetitions(comps)
      // Default: select top 3 events by distance
      const top3 = pb.slice(0, 3).map(b => `${b.distance} ${b.style}`)
      setSelectedEvents(top3)
      setLoading(false)
    })
  }, [athlete, navigate])

  const qualified = useMemo(() => {
    if (!athlete || bests.length === 0) return false
    return isQualifiedForNationals(bests, athlete.category as never, athlete.sex)
  }, [athlete, bests])

  // Build chart series from all results, filtered by year and selected events
  const chartSeries: Series[] = useMemo(() => {
    if (!athlete || recentResults.length === 0) return []
    return selectedEvents.slice(0, 5).map((eventKey, i) => {
      const [distStr, ...styleParts] = eventKey.split(' ')
      const dist = parseInt(distStr)
      const style = styleParts.join(' ')
      const data = recentResults
        .filter(r =>
          r.distance === dist &&
          r.style === style &&
          (chartYear === 'all' || r.year === chartYear) &&
          isFinite(r.timeSeconds),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => ({
          date: r.date,
          timeSeconds: r.timeSeconds,
          competition: r.competitionName,
          formattedTime: r.time,
        }))
      return {
        label: `${dist}m ${style}`,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        data,
      }
    })
  }, [recentResults, selectedEvents, chartYear, athlete])

  function handleChartPointClick(point: DataPoint) {
    const comp = competitions.find(c => c.name === point.competition)
    if (comp) navigate(`/competitions/${encodeURIComponent(comp.key)}`)
  }

  function toggleEvent(key: string) {
    setSelectedEvents(prev =>
      prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key].slice(0, 5),
    )
  }

  if (!athlete) return null

  return (
    <div className="page-content">
      {/* Athlete header */}
      <div className="athlete-header">
        <div className="athlete-header-top">
          <div className="athlete-header-avatar">{athlete.initials}</div>
          <div>
            <div className="athlete-header-name">{athlete.firstName} {athlete.lastName}</div>
            <div className="athlete-header-sub">{athlete.club}</div>
          </div>
        </div>
        <div className="athlete-header-badges">
          <span className="athlete-header-badge">{athlete.category}</span>
          <span className="athlete-header-badge">{athlete.sex === 'F' ? '♀ Femminile' : '♂ Maschile'}</span>
          <span className="athlete-header-badge">Nato/a nel {athlete.birthYear}</span>
        </div>
        {session?.user && (
          <div className="athlete-header-reg">
            Tesserino: {session.user.registrationNumber}
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="home-actions">
        <button className="btn btn--ghost btn--sm" onClick={clearAthlete}>⇄ Cambia</button>
        <button className="btn btn--ghost btn--sm" onClick={logout}>Esci</button>
      </div>

      {loading ? (
        <LoadingState text="Caricamento dati atleta..." />
      ) : (
        <>
          {/* Qualification */}
          <QualificationBadge qualified={qualified} category={athlete.category} />

          {/* Stats */}
          <div className="stats-row" style={{ marginTop: 16 }}>
            <div className="stat-card">
              <span className="stat-icon">🏅</span>
              <span className="stat-value">{bests.length}</span>
              <span className="stat-label">Record personali</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🏟️</span>
              <span className="stat-value">{competitions.length}</span>
              <span className="stat-label">Gare</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">📅</span>
              <span className="stat-value">{years[0] ?? '—'}</span>
              <span className="stat-label">Ultima stagione</span>
            </div>
          </div>

          {/* Performance chart */}
          {bests.length > 0 && (
            <section className="section">
              <h2 className="section-title">📈 Progressione tempi</h2>

              {/* Year filter */}
              <div className="filter-row" style={{ marginBottom: 10 }}>
                <select
                  className="filter-select"
                  value={chartYear}
                  onChange={e => setChartYear(e.target.value)}
                >
                  <option value="all">Tutti gli anni</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* Event toggles */}
              <div className="event-pills">
                {eventOptions.map((ev, _i) => (
                  <button
                    key={ev.key}
                    className={`event-pill${selectedEvents.includes(ev.key) ? ' active' : ''}`}
                    style={selectedEvents.includes(ev.key)
                      ? { borderColor: SERIES_COLORS[selectedEvents.indexOf(ev.key) % SERIES_COLORS.length], color: SERIES_COLORS[selectedEvents.indexOf(ev.key) % SERIES_COLORS.length] }
                      : {}}
                    onClick={() => toggleEvent(ev.key)}
                    title={`${STYLE_EMOJI[ev.key.split(' ').slice(1).join(' ')] ?? '🏊'} ${ev.label}`}
                  >
                    {STYLE_EMOJI[ev.key.split(' ').slice(1).join(' ')] ?? '🏊'} {ev.label}
                  </button>
                ))}
                {eventOptions.length === 0 && <span className="text-muted text-sm">Nessun evento disponibile</span>}
              </div>

              <div style={{ marginTop: 12 }}>
                <PerformanceChart series={chartSeries} onPointClick={handleChartPointClick} />
              </div>
            </section>
          )}

          {/* Personal bests */}
          {bests.length > 0 && (
            <section className="section">
              <h2 className="section-title">🥇 Record personali</h2>
              <div className="record-list">
                {bests.slice(0, 8).map(b => (
                  <div key={`${b.style}-${b.distance}`} className="record-card">
                    <span className="record-event-icon">
                      {STYLE_EMOJI[b.style] ?? '🏊'}
                    </span>
                    <div className="record-info">
                      <div className="record-event-name">{b.distance}m {b.style}</div>
                      <div className="record-meta">{formatDate(b.date)} · {b.competitionName}</div>
                    </div>
                    <div className="record-time">{b.time}</div>
                  </div>
                ))}
              </div>
              {bests.length > 8 && (
                <button className="see-all-btn" onClick={() => navigate('/records')}>
                  Vedi tutti i {bests.length} record →
                </button>
              )}
            </section>
          )}

          {/* Recent competitions */}
          {competitions.length > 0 && (
            <section className="section">
              <h2 className="section-title">🕐 Ultime gare</h2>
              {competitions.slice(0, 4).map(c => (
                <div
                  key={c.key}
                  className="competition-card"
                  onClick={() => navigate(`/competitions/${encodeURIComponent(c.key)}`)}
                >
                  <div className="competition-name">{c.name}</div>
                  <div className="competition-meta">
                    <span>📅 {formatDate(c.date)}</span>
                    <span>🏅 {c.results.length} {c.results.length === 1 ? 'gara' : 'gare'}</span>
                  </div>
                  <div className="competition-results">
                    {c.results.slice(0, 3).map(r => (
                      <span key={r.id} className="competition-result-pill">
                        {r.distance}m {r.style} · {r.time}
                        {r.position > 0 && ` · ${r.position}°`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <button className="see-all-btn" onClick={() => navigate('/competitions')}>
                Vedi tutte le gare →
              </button>
            </section>
          )}

          {bests.length === 0 && (
            <div className="empty-state" style={{ marginTop: 32 }}>
              <div className="empty-state-icon">🏊</div>
              <div className="empty-state-title">Nessun risultato trovato</div>
              <div className="empty-state-text">
                Non ci sono ancora risultati nell'archivio per questo atleta.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
