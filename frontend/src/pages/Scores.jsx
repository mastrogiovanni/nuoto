import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSwimmer } from '../context/SwimmerContext'
import { getResults } from '../api'
import './Scores.css'

const STYLE_EMOJI = {
  'Stile libero': '🌊',
  'Dorso':        '🔄',
  'Rana':         '🐸',
  'Delfino':      '🐬',
  'Misto':        '🔀',
}

export default function Scores() {
  const { swimmer } = useSwimmer()
  const navigate = useNavigate()
  const [results, setResults] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ style: '', distance: '', year: '' })
  const [sortBy, setSortBy] = useState('date') // 'date' | 'time'
  const [view, setView] = useState('list') // 'list' | 'bests'
  const [bestTimes, setBestTimes] = useState([])

  useEffect(() => {
    if (!swimmer) { navigate('/'); return }
    getResults(swimmer.id).then(data => {
      setResults(data)
      setFiltered(data)

      // Build best times map
      const best = {}
      data.forEach(r => {
        const key = `${r.style}||${r.distance}`
        if (!best[key] || parseTime(r.time) < parseTime(best[key].time)) {
          best[key] = r
        }
      })
      setBestTimes(Object.values(best).sort((a, b) =>
        a.style.localeCompare(b.style) || a.distance - b.distance
      ))
      setLoading(false)
    })
  }, [swimmer, navigate])

  useEffect(() => {
    let data = [...results]
    if (filters.style)    data = data.filter(r => r.style === filters.style)
    if (filters.distance) data = data.filter(r => r.distance === Number(filters.distance))
    if (filters.year)     data = data.filter(r => r.date.startsWith(filters.year))
    if (sortBy === 'time') {
      data.sort((a, b) => parseTime(a.time) - parseTime(b.time))
    } else {
      data.sort((a, b) => new Date(b.date) - new Date(a.date))
    }
    setFiltered(data)
  }, [filters, sortBy, results])

  function parseTime(t) {
    if (t.includes(':')) {
      const [m, s] = t.split(':')
      return parseInt(m) * 60 + parseFloat(s)
    }
    return parseFloat(t)
  }

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function resetFilters() {
    setFilters({ style: '', distance: '', year: '' })
  }

  const years = [...new Set(results.map(r => r.date.slice(0, 4)))].sort().reverse()
  const styles = [...new Set(results.map(r => r.style))].sort()
  const distances = [...new Set(results.map(r => r.distance))].sort((a, b) => a - b)
  const hasFilters = filters.style || filters.distance || filters.year

  if (loading) {
    return (
      <div className="loading-center">
        <span className="big-spinner" />
        <p>Caricamento risultati...</p>
      </div>
    )
  }

  return (
    <div className="scores-page">
      <div className="scores-header">
        <h2 className="page-title">Risultati di {swimmer.firstName}</h2>
        <span className="result-count">{filtered.length} gare</span>
      </div>

      {/* View toggle */}
      <div className="view-toggle">
        <button
          className={`toggle-btn ${view === 'list' ? 'active' : ''}`}
          onClick={() => setView('list')}
        >
          📋 Tutte le gare
        </button>
        <button
          className={`toggle-btn ${view === 'bests' ? 'active' : ''}`}
          onClick={() => setView('bests')}
        >
          🥇 Record personali
        </button>
      </div>

      {view === 'bests' ? (
        <div className="bests-view">
          {bestTimes.map(r => {
            const emoji = STYLE_EMOJI[r.style] || '🏊'
            return (
              <div key={`${r.style}-${r.distance}`} className="best-card">
                <div className="best-card-header">
                  <span className="best-event-emoji">{emoji}</span>
                  <div>
                    <div className="best-event-name">{r.style}</div>
                    <div className="best-event-dist">{r.distance}m{r.pool ? ` · ${r.pool}` : ''}</div>
                  </div>
                  <div className="best-time-badge">{r.time}</div>
                </div>
                <div className="best-card-meta">
                  <span>📍 {r.competition}</span>
                  <span>📅 {new Date(r.date).toLocaleDateString('it-IT')}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="filters">
            <select
              className="filter-select"
              value={filters.style}
              onChange={e => setFilter('style', e.target.value)}
            >
              <option value="">Tutti gli stili</option>
              {styles.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              className="filter-select"
              value={filters.distance}
              onChange={e => setFilter('distance', e.target.value)}
            >
              <option value="">Tutte le distanze</option>
              {distances.map(d => <option key={d} value={d}>{d}m</option>)}
            </select>

            <select
              className="filter-select"
              value={filters.year}
              onChange={e => setFilter('year', e.target.value)}
            >
              <option value="">Tutti gli anni</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {hasFilters && (
              <button className="reset-btn" onClick={resetFilters}>✕ Reset</button>
            )}
          </div>

          {/* Sort */}
          <div className="sort-row">
            <span className="sort-label">Ordina per:</span>
            <button
              className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
              onClick={() => setSortBy('date')}
            >
              Data
            </button>
            <button
              className={`sort-btn ${sortBy === 'time' ? 'active' : ''}`}
              onClick={() => setSortBy('time')}
            >
              Tempo
            </button>
          </div>

          {/* Results list */}
          {filtered.length === 0 ? (
            <div className="empty-state">
              <span>🔍</span>
              <p>Nessun risultato trovato con questi filtri.</p>
              <button className="reset-btn" onClick={resetFilters}>Rimuovi filtri</button>
            </div>
          ) : (
            <div className="result-list">
              {filtered.map(r => {
                const emoji = STYLE_EMOJI[r.style] || '🏊'
                return (
                  <div key={r.id} className="result-card">
                    <div className="result-top">
                      <div className="result-event">
                        <span className="result-emoji">{emoji}</span>
                        <div>
                          <div className="result-event-name">{r.distance}m {r.style}</div>
                          <div className="result-pool">{r.pool}</div>
                        </div>
                      </div>
                      <div className="result-time">{r.time}</div>
                    </div>
                    <div className="result-bottom">
                      <span className="result-comp">{r.competition}</span>
                      <div className="result-meta-right">
                        <span className="result-position">{r.position}° posto</span>
                        <span className="result-date">{new Date(r.date).toLocaleDateString('it-IT')}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
