import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSwimmer, getPersonalBests, getCompetitions } from '../api'
import type { Swimmer, PersonalBest, Competition } from '../types'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import QualificationBadge from '../components/QualificationBadge'
import { isQualifiedForNationals } from '../utils/qualification'
import { formatDate } from '../utils/time'

const STYLE_EMOJI: Record<string, string> = {
  'Stile Libero': '🌊', 'Dorso': '🔄', 'Rana': '🐸', 'Delfino': '🐬', 'Misto': '🔀',
}

export default function AthleteProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null)
  const [bests, setBests] = useState<PersonalBest[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<'bests' | 'competitions'>('bests')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getSwimmer(id), getPersonalBests(id), getCompetitions(id)]).then(
      ([s, pb, comps]) => {
        if (!s) { setNotFound(true); setLoading(false); return }
        setSwimmer(s)
        setBests(pb)
        setCompetitions(comps)
        setLoading(false)
      },
    )
  }, [id])

  if (loading) return <div className="page-content"><LoadingState text="Caricamento profilo..." /></div>
  if (notFound || !swimmer) {
    return (
      <div className="page-content">
        <button className="back-btn" onClick={() => navigate(-1)}>← Indietro</button>
        <EmptyState icon="🏊" title="Atleta non trovato" subtitle="Il profilo richiesto non è disponibile." />
      </div>
    )
  }

  const qualified = bests.length > 0
    ? isQualifiedForNationals(bests, swimmer.category as never, swimmer.sex)
    : false

  return (
    <div className="page-content">
      <button className="back-btn" onClick={() => navigate(-1)}>← Indietro</button>

      {/* Header */}
      <div className="athlete-header">
        <div className="athlete-header-top">
          <div className="athlete-header-avatar">{swimmer.initials}</div>
          <div>
            <div className="athlete-header-name">{swimmer.firstName} {swimmer.lastName}</div>
            <div className="athlete-header-sub">{swimmer.club}</div>
          </div>
        </div>
        <div className="athlete-header-badges">
          <span className="athlete-header-badge">{swimmer.category}</span>
          <span className="athlete-header-badge">{swimmer.sex === 'F' ? '♀' : '♂'}</span>
          <span className="athlete-header-badge">Nato/a nel {swimmer.birthYear}</span>
        </div>
      </div>

      <QualificationBadge qualified={qualified} category={swimmer.category} />

      {/* Stats */}
      <div className="stats-row" style={{ marginTop: 14 }}>
        <div className="stat-card">
          <span className="stat-icon">🥇</span>
          <span className="stat-value">{bests.length}</span>
          <span className="stat-label">Record pers.</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏟️</span>
          <span className="stat-value">{competitions.length}</span>
          <span className="stat-label">Gare</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📅</span>
          <span className="stat-value">{swimmer.birthYear}</span>
          <span className="stat-label">Anno nasc.</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginTop: 20 }}>
        <button
          className={`tab-btn${activeTab === 'bests' ? ' active' : ''}`}
          onClick={() => setActiveTab('bests')}
        >
          Record personali
        </button>
        <button
          className={`tab-btn${activeTab === 'competitions' ? ' active' : ''}`}
          onClick={() => setActiveTab('competitions')}
        >
          Gare
        </button>
      </div>

      {activeTab === 'bests' && (
        <div>
          {bests.length === 0 ? (
            <EmptyState icon="🏊" title="Nessun record disponibile" />
          ) : (
            bests.map(b => (
              <div key={`${b.style}-${b.distance}`} className="record-card">
                <span className="record-event-icon">{STYLE_EMOJI[b.style] ?? '🏊'}</span>
                <div className="record-info">
                  <div className="record-event-name">{b.distance}m {b.style}</div>
                  <div className="record-meta">{formatDate(b.date)} · {b.competitionName}</div>
                </div>
                <div className="record-time">{b.time}</div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'competitions' && (
        <div>
          {competitions.length === 0 ? (
            <EmptyState icon="🏟️" title="Nessuna gara disponibile" />
          ) : (
            competitions.map(c => (
              <div key={c.key} className="competition-card">
                <div className="competition-name">{c.name}</div>
                <div className="competition-meta">
                  <span>📅 {formatDate(c.date)}</span>
                  <span>🏅 {c.results.length} {c.results.length === 1 ? 'gara' : 'gare'}</span>
                </div>
                <div className="competition-results">
                  {c.results.slice(0, 3).map(r => (
                    <span key={r.id} className="competition-result-pill">
                      {r.distance}m {r.style} · {r.time}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
