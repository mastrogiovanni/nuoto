import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSwimmer } from '../context/SwimmerContext'
import { getBestTimesForSwimmer, getResults } from '../api'
import './Dashboard.css'

function StatCard({ icon, value, label }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function BestTimeRow({ record }) {
  if (!record) return null
  return (
    <div className="best-time-row">
      <div className="best-time-event">
        <span className="event-distance">{record.distance}m</span>
        <span className="event-style">{record.style}</span>
      </div>
      <span className="best-time-value">{record.time}</span>
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
      <div className="greeting-card">
        <div className="greeting-avatar">{swimmer.avatarInitials}</div>
        <div className="greeting-text">
          <h2>Ciao, {swimmer.firstName}! 👋</h2>
          <p>{swimmer.club} · Nato/a nel {swimmer.birthYear}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <span className="big-spinner" />
          <p>Caricamento dati...</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="stats-row">
            <StatCard icon="🏅" value={recentResults.length > 0 ? bestTimes.length : '—'} label="Record personali" />
            <StatCard icon="📅" value={currentYear} label="Stagione" />
            <StatCard icon="🏆" value={recentResults[0]?.competition ? recentResults[0].position + '°' : '—'} label="Ultima gara" />
          </div>

          {/* Quick actions */}
          <div className="quick-actions">
            <button className="action-btn primary" onClick={() => navigate('/scores')}>
              <span className="action-icon">🏅</span>
              <span>Tutti i risultati</span>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-btn secondary" onClick={() => navigate('/compare')}>
              <span className="action-icon">⚡</span>
              <span>Confronta con un nuotatore</span>
              <span className="action-arrow">›</span>
            </button>
          </div>

          {/* Personal bests */}
          {bestTimes.length > 0 && (
            <section className="section">
              <h3 className="section-title">🥇 Record personali</h3>
              <div className="best-times-list">
                {bestTimes.slice(0, 6).map(r => (
                  <BestTimeRow key={`${r.style}-${r.distance}`} record={r} />
                ))}
              </div>
              {bestTimes.length > 6 && (
                <button className="see-all-btn" onClick={() => navigate('/scores')}>
                  Vedi tutti ({bestTimes.length}) →
                </button>
              )}
            </section>
          )}

          {/* Recent results */}
          {recentResults.length > 0 && (
            <section className="section">
              <h3 className="section-title">🕐 Ultime gare</h3>
              <div className="recent-list">
                {recentResults.map(r => (
                  <div key={r.id} className="recent-item">
                    <div className="recent-left">
                      <span className="recent-event">{r.distance}m {r.style}</span>
                      <span className="recent-comp">{r.competition}</span>
                    </div>
                    <div className="recent-right">
                      <span className="recent-time">{r.time}</span>
                      <span className="recent-date">{new Date(r.date).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="see-all-btn" onClick={() => navigate('/scores')}>
                Vedi tutti i risultati →
              </button>
            </section>
          )}
        </>
      )}
    </div>
  )
}
