import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { getCompetitions } from '../api'
import type { Competition, RaceResult } from '../types'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import { formatDate } from '../utils/time'

const STYLE_EMOJI: Record<string, string> = {
  'Stile Libero': '🌊', 'Dorso': '🔄', 'Rana': '🐸', 'Delfino': '🐬', 'Misto': '🔀',
}

function PosMedal({ pos }: { pos: number }) {
  if (pos === 1) return <span title="1° posto">🥇</span>
  if (pos === 2) return <span title="2° posto">🥈</span>
  if (pos === 3) return <span title="3° posto">🥉</span>
  if (pos > 0)   return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{pos}°</span>
  return null
}

// ─── Competition List ──────────────────────────────────────────────────────────

export function CompetitionsList() {
  const { athlete } = useSession()
  const navigate = useNavigate()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<string>('all')

  useEffect(() => {
    if (!athlete) { navigate('/onboarding', { replace: true }); return }
    getCompetitions(athlete.id).then(comps => {
      setCompetitions(comps)
      setLoading(false)
    })
  }, [athlete, navigate])

  const years = [...new Set(competitions.map(c => c.year))].sort().reverse()
  const filtered = yearFilter === 'all' ? competitions : competitions.filter(c => c.year === yearFilter)

  return (
    <div className="page-content">
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Le mie Gare</h1>
        <p className="page-subtitle">{athlete?.firstName} {athlete?.lastName}</p>
      </div>

      {loading ? (
        <LoadingState text="Caricamento gare..." />
      ) : (
        <>
          {years.length > 1 && (
            <div className="filter-row" style={{ marginBottom: 14 }}>
              <select
                className="filter-select"
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
              >
                <option value="all">Tutte le stagioni</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState icon="🏟️" title="Nessuna gara trovata" />
          ) : (
            filtered.map(c => (
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
                  {c.results.slice(0, 4).map(r => (
                    <span key={r.id} className="competition-result-pill">
                      {r.distance}m {r.style} · {r.time}
                      {r.position > 0 && ` · ${r.position}°`}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}

// ─── Competition Detail ────────────────────────────────────────────────────────

export function CompetitionDetail() {
  const { id } = useParams<{ id: string }>()
  const { athlete } = useSession()
  const navigate = useNavigate()
  const [results, setResults] = useState<RaceResult[]>([])
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!athlete || !id) return
    const decodedKey = decodeURIComponent(id)
    getCompetitions(athlete.id).then(comps => {
      const comp = comps.find(c => c.key === decodedKey)
      if (comp) {
        setCompetition(comp)
        setResults(comp.results)
      }
      setLoading(false)
    })
  }, [athlete, id])

  return (
    <div className="page-content">
      <button className="back-btn" onClick={() => navigate(-1)}>← Indietro</button>

      {loading ? (
        <LoadingState />
      ) : !competition ? (
        <EmptyState icon="🏟️" title="Gara non trovata" />
      ) : (
        <>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{competition.name}</h1>
          <p className="page-subtitle">📅 {formatDate(competition.date)}</p>

          <div style={{ marginTop: 20 }}>
            {results.map(r => (
              <div key={r.id} className="result-card">
                <div className="result-top">
                  <div className="result-event">
                    <span style={{ fontSize: 24 }}>{STYLE_EMOJI[r.style] ?? '🏊'}</span>
                    <div>
                      <div className="result-event-name">{r.distance}m {r.style}</div>
                      {r.category && <div className="result-sub">{r.category}</div>}
                    </div>
                  </div>
                  <div className="result-time">{r.time}</div>
                </div>
                <div className="result-bottom">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PosMedal pos={r.position} />
                    {r.position > 0 && <span>{r.position}° posto</span>}
                  </div>
                  <span>{formatDate(r.date)}</span>
                </div>

                {/* Splits */}
                {r.splits.length > 0 && (
                  <div className="splits-section">
                    <div className="splits-title">Parziali</div>
                    <div className="splits-row">
                      {r.splits.map(s => (
                        <div key={s.metres} className="split-chip">
                          <span className="split-metres">{s.metres}m</span>
                          <span className="split-time">{s.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default CompetitionsList
