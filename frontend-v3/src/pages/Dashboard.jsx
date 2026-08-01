import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSwimmer } from '../context/SwimmerContext'
import { getBestTimesForSwimmer, getResults } from '../api'
import { formatTime } from '../utils'
import './Dashboard.css'

function StatCard({ icon, value, label }) {
  return (
    <div className="stat-card card">
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function BestTimeRow({ record, rank }) {
  if (!record) return null
  const rankClass = rank === 1 ? 'rank-badge--gold' : rank === 2 ? 'rank-badge--silver' : rank === 3 ? 'rank-badge--bronze' : ''
  return (
    <div className="best-time-row">
      <div className={`rank-badge ${rankClass}`}>{rank}</div>
      <div className="best-time-event">
        <span className="event-distance">{record.distance}m</span>
        <span className="event-style">{record.style}</span>
      </div>
      <span className="time-display best-time-value">{formatTime(record.time)}</span>
    </div>
  )
}

export default function Dashboard() {
  const { swimmer } = useSwimmer()
  const navigate = useNavigate()
  const [bestTimes, setBestTimes] = useState([])
  const [recentResults, setRecentResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!swimmer) { navigate('/'); return }
    Promise.all([
      getBestTimesForSwimmer(swimmer.id),
      getResults(swimmer.id),
    ]).then(([bests, results]) => {
      setBestTimes(bests)
      setRecentResults(results.slice(0, 5))
      setLoading(false)
    })
  }, [swimmer, navigate])

  if (!swimmer) return null

  const currentYear = new Date().getFullYear()

  return (
    <div className="dashboard">
      {/* Greeting */}
      <div className="greeting-card card">
        <div className="greeting-avatar">{swimmer.avatarInitials}</div>
        <div className="greeting-text">
          <h2>Ciao, {swimmer.firstName}!</h2>
          <p>{swimmer.club} · {swimmer.birthYear}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-center">
          <span className="big-spinner" />
          <p>Caricamento dati...</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="stats-row">
            <StatCard icon="🥇" value={bestTimes.length || '—'} label="Record personali" />
            <StatCard icon="📅" value={currentYear} label="Stagione" />
            <StatCard icon="🏅" value={recentResults[0]?.position ? `${recentResults[0].position}°` : '—'} label="Ultima gara" />
          </div>

          {/* Quick actions */}
          <div className="quick-actions">
            <button className="action-btn card" onClick={() => navigate('/scores')}>
              <span className="action-icon action-icon--blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6"/>
                  <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                </svg>
              </span>
              <span className="action-label">Tutti i risultati</span>
              <span className="chevron">❯</span>
            </button>
            <button className="action-btn card" onClick={() => navigate('/compare')}>
              <span className="action-icon action-icon--purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              </span>
              <span className="action-label">Confronta nuotatori</span>
              <span className="chevron">❯</span>
            </button>
            <button className="action-btn card" onClick={() => navigate('/records')}>
              <span className="action-icon action-icon--gold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </span>
              <span className="action-label">Primati Italiani</span>
              <span className="chevron">❯</span>
            </button>
          </div>

          {/* Personal bests */}
          {bestTimes.length > 0 && (
            <section className="section">
              <div className="section-header">
                <h3 className="section-title">Record personali</h3>
                {bestTimes.length > 6 && (
                  <button className="see-all-btn" onClick={() => navigate('/scores')}>
                    Vedi tutti →
                  </button>
                )}
              </div>
              <div className="best-times-list card">
                {bestTimes.slice(0, 6).map((r, i) => (
                  <BestTimeRow key={`${r.style}-${r.distance}`} record={r} rank={i + 1} />
                ))}
              </div>
            </section>
          )}

          {/* Recent results */}
          {recentResults.length > 0 && (
            <section className="section">
              <div className="section-header">
                <h3 className="section-title">Ultime gare</h3>
                <button className="see-all-btn" onClick={() => navigate('/scores')}>
                  Tutte →
                </button>
              </div>
              <div className="recent-list card">
                {recentResults.map((r, i) => (
                  <div key={r.id} className="recent-item">
                    <div className={`rank-badge${i === 0 ? ' rank-badge--gold' : i === 1 ? ' rank-badge--silver' : i === 2 ? ' rank-badge--bronze' : ''}`}>
                      {r.position ? `${r.position}°` : i + 1}
                    </div>
                    <div className="recent-left">
                      <span className="recent-event">{r.distance}m {r.style}</span>
                      <span className="recent-comp">{r.competition}</span>
                    </div>
                    <div className="recent-right">
                      <span className="time-display recent-time">{formatTime(r.time)}</span>
                      <span className="recent-date">{new Date(r.date).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
