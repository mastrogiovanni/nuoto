import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { getRanking } from '../api'
import type { Swimmer, RaceResult } from '../types'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'

interface RankingEntry {
  swimmer: Swimmer
  result: RaceResult | null
}

function PosBadge({ pos }: { pos: number }) {
  const label = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}°`
  const cls = pos <= 3 ? `pos-badge pos-badge--${pos}` : 'pos-badge pos-badge--other'
  return <div className={cls}>{label}</div>
}

export default function RankingDetail() {
  const { year, event } = useParams<{ year: string; event: string }>()
  const { athlete: currentAthlete } = useSession()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const eventName = decodeURIComponent(event ?? '').replace(/_/g, ' ')

  useEffect(() => {
    if (!year || !event) return
    setLoading(true)
    getRanking(year, decodeURIComponent(event))
      .then(data => { setEntries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, event])

  const filtered = entries.filter(e =>
    `${e.swimmer.firstName} ${e.swimmer.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    e.swimmer.club.toLowerCase().includes(search.toLowerCase()),
  )

  // Re-rank after filtering to preserve absolute positions
  const ranked = filtered.map(e => ({ ...e, displayPos: entries.indexOf(e) + 1 }))

  return (
    <div className="page-content">
      <button className="back-btn" onClick={() => navigate(-1)}>← Indietro</button>
      <h1 className="page-title" style={{ marginBottom: 4 }}>{eventName}</h1>
      <p className="page-subtitle">Stagione {year} · {entries.length} atleti</p>

      {/* Search */}
      <div className="search-bar" style={{ margin: '14px 0' }}>
        <span className="search-bar-icon">🔍</span>
        <input
          className="search-bar-input"
          type="search"
          placeholder="Cerca atleta o società..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingState text="Caricamento classifica..." />
      ) : entries.length === 0 ? (
        <EmptyState icon="🏊" title="Nessun atleta trovato" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nessun risultato"
          action={{ label: 'Cancella filtro', onClick: () => setSearch('') }}
        />
      ) : (
        <div className="leaderboard card">
          {ranked.map(({ swimmer, result, displayPos }) => {
            const isMe = currentAthlete?.id === swimmer.id
            return (
              <div
                key={swimmer.id}
                className={`leaderboard-row${isMe ? ' leaderboard-row--highlighted' : ''}`}
                onClick={() => navigate(`/search/athlete/${swimmer.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="leaderboard-pos">
                  {displayPos <= 3
                    ? <PosBadge pos={displayPos} />
                    : <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{displayPos}°</span>
                  }
                </div>
                <div className="leaderboard-name">
                  <div className="leaderboard-name-text">
                    {swimmer.firstName} {swimmer.lastName}
                    {isMe && <span className="you-badge"> TU</span>}
                  </div>
                  <div className="leaderboard-club">{swimmer.club} · {swimmer.category}</div>
                </div>
                <div className="leaderboard-time">
                  {result ? result.time : '—'}
                </div>
                <span className="leaderboard-arrow">›</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
