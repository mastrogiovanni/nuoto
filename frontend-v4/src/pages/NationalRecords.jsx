import { useState, useEffect } from 'react'
import { getRecordsMeta, getRecords } from '../api'
import { formatTime } from '../utils'

export default function NationalRecords() {
  const [meta, setMeta] = useState([])
  const [vasca, setVasca] = useState('25')
  const [gender, setGender] = useState('M')
  const [championship, setChampionship] = useState('')
  const [records, setRecords] = useState(null)
  const [loading, setLoading] = useState(false)
  const [metaError, setMetaError] = useState(false)

  useEffect(() => {
    getRecordsMeta()
      .then(data => {
        setMeta(data)
        if (data.length > 0) {
          setVasca(data[0].vasca)
          setGender(data[0].gender)
          setChampionship(data[0].championship)
        }
      })
      .catch(() => setMetaError(true))
  }, [])

  useEffect(() => {
    if (!vasca || !championship || !gender) return
    setLoading(true)
    setRecords(null)
    getRecords(vasca, championship, gender)
      .then(data => { setRecords(data); setLoading(false) })
      .catch(() => { setRecords([]); setLoading(false) })
  }, [vasca, championship, gender])

  const vascaOptions = [...new Set(meta.map(m => m.vasca))].sort()
  const champOptions = [...new Set(meta.filter(m => m.vasca === vasca).map(m => m.championship))].sort()

  const recordRows = Array.isArray(records) ? records : (records?.records ?? [])

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Primati Italiani</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: 4 }}>
          Record nazionali ufficiali FIN
        </p>
      </div>

      {metaError ? (
        <div className="empty-state">
          <span className="empty-icon">⚠️</span>
          <p>Primati non disponibili.</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>Vasca</label>
                <div className="seg-ctrl">
                  {vascaOptions.map(v => (
                    <button key={v} className={`seg-btn${vasca === v ? ' active' : ''}`} onClick={() => setVasca(v)}>
                      {v}m
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>Genere</label>
                <div className="seg-ctrl">
                  <button className={`seg-btn${gender === 'M' ? ' active' : ''}`} onClick={() => setGender('M')}>M</button>
                  <button className={`seg-btn${gender === 'F' ? ' active' : ''}`} onClick={() => setGender('F')}>F</button>
                </div>
              </div>
            </div>

            {champOptions.length > 0 && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>Campionato</label>
                <select className="filter-select" style={{ width: '100%' }} value={championship} onChange={e => setChampionship(e.target.value)}>
                  {champOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="loading-center"><span className="spinner" /></div>
          ) : recordRows.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {recordRows.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < recordRows.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.event || r.gara}</div>
                    {(r.athlete || r.atleta) && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginTop: 2 }}>
                        {r.athlete || r.atleta}
                      </div>
                    )}
                    {(r.date || r.data) && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {r.date || r.data}
                      </div>
                    )}
                  </div>
                  <span className="time-mono" style={{ color: 'var(--gold)' }}>
                    {formatTime(r.time || r.tempo)}
                  </span>
                </div>
              ))}
            </div>
          ) : records !== null ? (
            <div className="empty-state">
              <span className="empty-icon">🥇</span>
              <p>Nessun primato trovato per questa selezione.</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
