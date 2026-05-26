import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import {
  getPersonalBests,
  getProgressionForEvent,
  getRecordsMeta,
  getNationalRecords,
} from '../api'
import type { PersonalBest, RaceResult, NationalRecord, NationalRecordsIndexEntry } from '../types'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import PerformanceChart, { SERIES_COLORS, type Series } from '../components/PerformanceChart'
import { formatDate } from '../utils/time'

const STYLE_EMOJI: Record<string, string> = {
  'Stile Libero': '🌊', 'Dorso': '🔄', 'Rana': '🐸', 'Delfino': '🐬', 'Misto': '🔀',
}

const CHAMPIONSHIP_LABEL: Record<string, string> = {
  assoluti: 'Assoluti', mondiali: 'Mondiali', europei: 'Europei', olimpici: 'Olimpici',
  juniores: 'Juniores', cadetti: 'Cadetti', ragazzi: 'Ragazzi',
}

const SECTION_LABEL: Record<string, string> = {
  NAZIONALE: '🇮🇹 Nazionale', SOCIETÀ: '🏛️ Società',
}

// ─── Personal Records Tab ─────────────────────────────────────────────────────

function PersonalRecords({ athleteId }: { athleteId: string }) {
  const [bests, setBests] = useState<PersonalBest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PersonalBest | null>(null)
  const [progression, setProgression] = useState<RaceResult[]>([])
  const [loadingProgression, setLoadingProgression] = useState(false)
  const [styleFilter, setStyleFilter] = useState<string>('all')

  useEffect(() => {
    getPersonalBests(athleteId).then(pb => {
      setBests(pb)
      setLoading(false)
    })
  }, [athleteId])

  const styles = useMemo(() => ['all', ...new Set(bests.map(b => b.style))], [bests])
  const filtered = styleFilter === 'all' ? bests : bests.filter(b => b.style === styleFilter)

  async function handleSelectBest(b: PersonalBest) {
    if (selected?.style === b.style && selected.distance === b.distance) {
      setSelected(null)
      setProgression([])
      return
    }
    setSelected(b)
    setLoadingProgression(true)
    const data = await getProgressionForEvent(athleteId, b.style, b.distance)
    setProgression(data)
    setLoadingProgression(false)
  }

  const chartSeries: Series[] = useMemo(() => {
    if (!selected || progression.length === 0) return []
    return [{
      label: `${selected.distance}m ${selected.style}`,
      color: SERIES_COLORS[0],
      data: progression.map(r => ({
        date: r.date,
        timeSeconds: r.timeSeconds,
        competition: r.competitionName,
        formattedTime: r.time,
      })),
    }]
  }, [selected, progression])

  if (loading) return <LoadingState />

  return (
    <div>
      {/* Style filter */}
      {styles.length > 2 && (
        <div className="style-pills" style={{ marginBottom: 14 }}>
          {styles.map(s => (
            <button
              key={s}
              className={`style-pill${styleFilter === s ? ' active' : ''}`}
              onClick={() => setStyleFilter(s)}
            >
              {s === 'all' ? 'Tutti' : `${STYLE_EMOJI[s] ?? '🏊'} ${s}`}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="🏊" title="Nessun record personale" />
      ) : (
        filtered.map(b => {
          const isSelected = selected?.style === b.style && selected.distance === b.distance
          return (
            <div key={`${b.style}-${b.distance}`}>
              <div
                className={`record-card${isSelected ? ' record-card--selected' : ''}`}
                onClick={() => handleSelectBest(b)}
                style={{ cursor: 'pointer' }}
              >
                <span className="record-event-icon">{STYLE_EMOJI[b.style] ?? '🏊'}</span>
                <div className="record-info">
                  <div className="record-event-name">{b.distance}m {b.style}</div>
                  <div className="record-meta">{formatDate(b.date)} · {b.competitionName}</div>
                </div>
                <div className="record-right">
                  <div className="record-time">{b.time}</div>
                  <span className="record-expand">{isSelected ? '▲' : '▼'}</span>
                </div>
              </div>

              {isSelected && (
                <div className="record-detail-panel">
                  {loadingProgression ? (
                    <LoadingState text="Caricamento progressione..." />
                  ) : progression.length > 1 ? (
                    <>
                      <p className="record-detail-label">Progressione nel tempo ({progression.length} gare)</p>
                      <PerformanceChart series={chartSeries} />
                      <div className="progression-list">
                        {[...progression].reverse().map(r => (
                          <div key={r.id} className="progression-row">
                            <span className="progression-date">{formatDate(r.date)}</span>
                            <span className="progression-comp">{r.competitionName}</span>
                            <span className="progression-time">{r.time}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="progression-list">
                      {progression.map(r => (
                        <div key={r.id} className="progression-row">
                          <span className="progression-date">{formatDate(r.date)}</span>
                          <span className="progression-comp">{r.competitionName}</span>
                          <span className="progression-time">{r.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── National Records Tab ─────────────────────────────────────────────────────

function NationalRecordsTab() {
  const [meta, setMeta] = useState<NationalRecordsIndexEntry[]>([])
  const [vasca, setVasca] = useState('50m')
  const [championship, setChampionship] = useState('')
  const [gender, setGender] = useState('F')
  const [records, setRecords] = useState<NationalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')

  useEffect(() => {
    getRecordsMeta().then(data => {
      setMeta(data)
      const first = data.find(e => e.vasca === '50m') ?? data[0]
      if (first) { setVasca(first.vasca); setChampionship(first.championship); setGender(first.gender) }
    })
  }, [])

  const vascas = [...new Set(meta.map(e => e.vasca))].sort()
  const championships = [...new Set(meta.filter(e => e.vasca === vasca).map(e => e.championship))].sort()
  const genders = [...new Set(meta.filter(e => e.vasca === vasca && e.championship === championship).map(e => e.gender))].sort()

  useEffect(() => {
    const available = meta.filter(e => e.vasca === vasca).map(e => e.championship)
    if (!available.includes(championship) && available.length > 0) setChampionship(available[0])
  }, [vasca, meta, championship])

  useEffect(() => {
    const available = meta.filter(e => e.vasca === vasca && e.championship === championship).map(e => e.gender)
    if (!available.includes(gender) && available.length > 0) setGender(available[0])
  }, [championship, vasca, meta, gender])

  useEffect(() => {
    if (!championship || !gender) return
    setLoading(true)
    getNationalRecords(vasca, championship, gender)
      .then(data => { setRecords(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [vasca, championship, gender])

  const sections = [...new Set(records.map(r => r.section))].sort()
  const filtered = records.filter(r => {
    if (sectionFilter && r.section !== sectionFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.athlete.toLowerCase().includes(q) || r.specialita.toLowerCase().includes(q)
    }
    return true
  })

  function formatRecordDate(d: string) {
    if (!d) return ''
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`).toLocaleDateString('it-IT')
    return d
  }

  return (
    <div>
      <div className="filter-row">
        <select className="filter-select" value={vasca} onChange={e => setVasca(e.target.value)}>
          {vascas.map(v => <option key={v} value={v}>Vasca {v}</option>)}
        </select>
        <select className="filter-select" value={championship} onChange={e => setChampionship(e.target.value)}>
          {championships.map(c => <option key={c} value={c}>{CHAMPIONSHIP_LABEL[c] ?? c}</option>)}
        </select>
        <select className="filter-select" value={gender} onChange={e => setGender(e.target.value)}>
          {genders.map(g => <option key={g} value={g}>{g === 'F' ? '♀ Femminili' : '♂ Maschili'}</option>)}
        </select>
      </div>

      {records.length > 0 && (
        <div className="filter-row">
          <select className="filter-select" value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
            <option value="">Tutte le sezioni</option>
            {sections.map(s => <option key={s} value={s}>{SECTION_LABEL[s] ?? s}</option>)}
          </select>
          <input
            className="filter-select"
            type="search"
            placeholder="Cerca atleta o specialità..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 2 }}
          />
        </div>
      )}

      {loading ? (
        <LoadingState text="Caricamento primati..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🏆" title="Nessun primato trovato" />
      ) : (
        <div style={{ marginTop: 8 }}>
          {filtered.map((r, i) => (
            <div key={i} className="nat-record-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="nat-record-specialita">{r.specialita}</div>
                  <div className="nat-record-athlete">{r.athlete}</div>
                  {r.components && <div className="record-meta">{r.components}</div>}
                  <div className="nat-record-meta">📅 {formatRecordDate(r.date)} · 📍 {r.location}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="nat-record-time">{r.time}</div>
                  <div className={`nat-record-section nat-record-section--${r.section?.toLowerCase()}`}>
                    {SECTION_LABEL[r.section] ?? r.section}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Records Page ─────────────────────────────────────────────────────────────

export default function Records() {
  const { athlete } = useSession()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'personal' | 'national'>('personal')

  useEffect(() => {
    if (!athlete) navigate('/onboarding', { replace: true })
  }, [athlete, navigate])

  if (!athlete) return null

  return (
    <div className="page-content">
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Primati</h1>
      </div>

      <div className="tabs">
        <button
          className={`tab-btn${activeTab === 'personal' ? ' active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          Record personali
        </button>
        <button
          className={`tab-btn${activeTab === 'national' ? ' active' : ''}`}
          onClick={() => setActiveTab('national')}
        >
          🇮🇹 Primati Italiani
        </button>
      </div>

      {activeTab === 'personal' && <PersonalRecords athleteId={athlete.id} />}
      {activeTab === 'national' && <NationalRecordsTab />}
    </div>
  )
}
