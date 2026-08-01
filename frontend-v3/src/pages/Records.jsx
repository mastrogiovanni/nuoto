import { useEffect, useState } from 'react'
import { getRecordsMeta, getRecords } from '../api'
import { formatTime } from '../utils'
import './Records.css'

const CHAMPIONSHIP_LABEL = {
  assoluti:  'Assoluti',
  mondiali:  'Mondiali',
  europei:   'Europei',
  olimpici:  'Olimpici',
  juniores:  'Juniores',
  cadetti:   'Cadetti',
  ragazzi:   'Ragazzi',
}

const SECTION_LABEL = {
  NAZIONALE: 'Nazionale',
  SOCIETÀ:   'Società',
}

export default function Records() {
  const [meta, setMeta] = useState([])
  const [vasca, setVasca] = useState('50m')
  const [championship, setChampionship] = useState('')
  const [gender, setGender] = useState('F')
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    getRecordsMeta().then(data => {
      setMeta(data)
      if (data.length > 0) {
        const first = data.find(e => e.vasca === '50m') ?? data[0]
        setVasca(first.vasca)
        setChampionship(first.championship)
        setGender(first.gender)
      }
    })
  }, [])

  const vascas = [...new Set(meta.map(e => e.vasca))].sort()
  const championships = [...new Set(meta.filter(e => e.vasca === vasca).map(e => e.championship))].sort()
  const genders = [...new Set(meta.filter(e => e.vasca === vasca && e.championship === championship).map(e => e.gender))].sort()

  useEffect(() => {
    if (!championship || !gender) return
    setLoading(true)
    setError('')
    setPage(null)
    getRecords(vasca, championship, gender)
      .then(data => { setPage(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [vasca, championship, gender])

  useEffect(() => {
    const available = meta.filter(e => e.vasca === vasca).map(e => e.championship)
    if (!available.includes(championship) && available.length > 0) {
      setChampionship(available[0])
    }
  }, [vasca, meta])

  useEffect(() => {
    const available = meta.filter(e => e.vasca === vasca && e.championship === championship).map(e => e.gender)
    if (!available.includes(gender) && available.length > 0) {
      setGender(available[0])
    }
  }, [championship, vasca, meta])

  const records = page?.records ?? []
  const sections = [...new Set(records.map(r => r.sezione))].sort()

  const filtered = records.filter(r => {
    if (sectionFilter && r.sezione !== sectionFilter) return false
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      return r.atleta.toLowerCase().includes(q) || r.specialita.toLowerCase().includes(q)
    }
    return true
  })

  function formatDate(d) {
    if (!d) return ''
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`).toLocaleDateString('it-IT')
    return d
  }

  return (
    <div className="records-page">
      <div className="records-header">
        <h2 className="page-title">Primati Italiani</h2>
        {page && <span className="badge-pill result-count">{filtered.length} record</span>}
      </div>

      {/* Primary filters */}
      <div className="filter-group">
        <div className="filter-chips">
          {vascas.map(v => (
            <button key={v} className={`filter-chip${vasca === v ? ' active' : ''}`} onClick={() => setVasca(v)}>
              {v}
            </button>
          ))}
        </div>
        <div className="filter-chips">
          {genders.map(g => (
            <button key={g} className={`filter-chip${gender === g ? ' active' : ''}`} onClick={() => setGender(g)}>
              {g === 'F' ? '♀ Femminile' : '♂ Maschile'}
            </button>
          ))}
        </div>
      </div>

      {/* Championship selector */}
      <div className="champ-scroll">
        {championships.map(c => (
          <button key={c} className={`champ-chip${championship === c ? ' active' : ''}`} onClick={() => setChampionship(c)}>
            {CHAMPIONSHIP_LABEL[c] ?? c}
          </button>
        ))}
      </div>

      {/* Section + search */}
      {page && (
        <div className="search-filter-row">
          <div className="section-pills">
            <button className={`section-pill${sectionFilter === '' ? ' active' : ''}`} onClick={() => setSectionFilter('')}>Tutti</button>
            {sections.map(s => (
              <button key={s} className={`section-pill${sectionFilter === s ? ' active' : ''}`} onClick={() => setSectionFilter(s)}>
                {SECTION_LABEL[s] ?? s}
              </button>
            ))}
          </div>
          <div className="search-box-mini">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              placeholder="Cerca atleta o specialità…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-center">
          <span className="big-spinner" />
          <p>Caricamento primati…</p>
        </div>
      )}

      {error && <div className="empty-state"><span>⚠️</span><p>{error}</p></div>}

      {!loading && !error && page && filtered.length === 0 && (
        <div className="empty-state"><span>🔍</span><p>Nessun primato trovato.</p></div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="record-list">
          {filtered.map((r, i) => (
            <div key={i} className="record-card card">
              <div className="record-rank rank-badge">{i + 1}</div>
              <div className="record-body">
                <div className="record-specialita">{r.specialita}</div>
                <div className="record-athlete">{r.atleta}</div>
                {r.componenti && <div className="record-componenti">{r.componenti}</div>}
                <div className="record-meta">
                  {formatDate(r.data)} · {r.luogo}
                </div>
              </div>
              <div className="record-right">
                <div className="time-display record-time">{formatTime(r.tempo)}</div>
                <span className={`record-section-badge badge-pill record-section--${r.sezione?.toLowerCase()}`}>
                  {SECTION_LABEL[r.sezione] ?? r.sezione}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
