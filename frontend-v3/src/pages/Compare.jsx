import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSwimmer } from '../context/SwimmerContext'
import { searchSwimmers, compareSwimmers } from '../api'
import { formatTime } from '../utils'
import './Compare.css'

function timeToSeconds(t) {
  if (!t) return Infinity
  if (t.includes(':')) {
    const [m, s] = t.split(':')
    return parseInt(m) * 60 + parseFloat(s)
  }
  return parseFloat(t)
}

function TimeCell({ record, winner }) {
  if (!record) return <span className="no-time">—</span>
  return (
    <div className={`time-cell${winner ? ' winner' : ''}`}>
      <span className={`time-display${winner ? ' winner-time' : ''}`}>{formatTime(record.time)}</span>
      {winner && <span className="winner-dot" />}
    </div>
  )
}

export default function Compare() {
  const { swimmer } = useSwimmer()
  const navigate = useNavigate()

  const [opponent, setOpponent] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchDone, setSearchDone] = useState(false)
  const [comparison, setComparison] = useState([])
  const [loadingComp, setLoadingComp] = useState(false)
  const [styleFilter, setStyleFilter] = useState('')
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!swimmer) { navigate('/'); return }
  }, [swimmer, navigate])

  useEffect(() => {
    if (searchTerm.trim().length < 1) {
      setSearchResults([])
      setSearchDone(false)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchSwimmers(searchTerm)
        setSearchResults(res.filter(s => s.id !== swimmer?.id))
        setSearchDone(true)
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [searchTerm, swimmer])

  async function handleSelectOpponent(s) {
    setOpponent(s)
    setSearchTerm('')
    setSearchResults([])
    setSearchDone(false)
    setLoadingComp(true)
    try {
      const data = await compareSwimmers(swimmer.id, s.id)
      setComparison(data)
    } finally {
      setLoadingComp(false)
    }
  }

  function clearOpponent() {
    setOpponent(null)
    setComparison([])
  }

  const styles = [...new Set(comparison.map(c => c.event.split(' ').slice(0, -1).join(' ')))]
  const filtered = styleFilter
    ? comparison.filter(c => c.event.startsWith(styleFilter))
    : comparison

  let winsA = 0, winsB = 0, ties = 0
  filtered.forEach(({ swimmerA, swimmerB }) => {
    const tA = timeToSeconds(swimmerA?.time)
    const tB = timeToSeconds(swimmerB?.time)
    if (tA === Infinity && tB === Infinity) return
    if (tA < tB) winsA++
    else if (tB < tA) winsB++
    else ties++
  })

  if (!swimmer) return null

  return (
    <div className="compare-page">
      <h2 className="page-title">Confronta</h2>

      {!opponent ? (
        <div className="search-section">
          <div className="search-hint-card card">
            <span className="search-hint-icon">⚡</span>
            <p>Cerca un nuotatore da confrontare con <strong>{swimmer.firstName}</strong></p>
          </div>

          <div className="search-box-wrap">
            <div className="search-box">
              <svg className="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                type="text"
                placeholder="Cerca per cognome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searching && <span className="search-spinner" />}
            </div>
          </div>

          {searchDone && searchResults.length === 0 && !searching && (
            <p className="no-results">Nessun nuotatore trovato.</p>
          )}

          {searchResults.length > 0 && (
            <ul className="swimmer-list">
              {searchResults.map(s => (
                <li key={s.id} className="swimmer-item card" onClick={() => handleSelectOpponent(s)}>
                  <div className="swimmer-avatar">{s.avatarInitials}</div>
                  <div className="swimmer-details">
                    <span className="swimmer-fullname">{s.firstName} {s.name}</span>
                    <span className="swimmer-meta">{s.club} · {s.birthYear}</span>
                  </div>
                  <span className="chevron">❯</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* Versus header */}
          <div className="versus-header card">
            <div className="vs-swimmer">
              <div className="vs-avatar vs-avatar--you">{swimmer.avatarInitials}</div>
              <div className="vs-name">{swimmer.firstName}</div>
              <div className="vs-club">{swimmer.club}</div>
            </div>
            <div className="vs-badge">VS</div>
            <div className="vs-swimmer">
              <div className="vs-avatar vs-avatar--them">{opponent.avatarInitials}</div>
              <div className="vs-name">{opponent.firstName}</div>
              <div className="vs-club">{opponent.club}</div>
            </div>
          </div>

          <button className="back-btn" onClick={clearOpponent}>
            ← Cambia avversario
          </button>

          {loadingComp ? (
            <div className="loading-center">
              <span className="big-spinner" />
              <p>Caricamento confronto...</p>
            </div>
          ) : (
            <>
              {/* Score summary */}
              <div className="score-summary card">
                <div className={`score-box${winsA > winsB ? ' score-box--leading' : ''}`}>
                  <span className="score-num">{winsA}</span>
                  <span className="score-lbl">{swimmer.firstName}</span>
                </div>
                <div className="score-divider">
                  <span>{winsA > winsB ? '🏆' : winsB > winsA ? '🏆' : '🤝'}</span>
                  {ties > 0 && <span className="ties-label">{ties} pari</span>}
                </div>
                <div className={`score-box${winsB > winsA ? ' score-box--leading' : ''}`}>
                  <span className="score-num">{winsB}</span>
                  <span className="score-lbl">{opponent.firstName}</span>
                </div>
              </div>

              {/* Style filter */}
              {styles.length > 1 && (
                <div className="style-pills">
                  <button className={`style-pill${styleFilter === '' ? ' active' : ''}`} onClick={() => setStyleFilter('')}>Tutti</button>
                  {styles.map(s => (
                    <button key={s} className={`style-pill${styleFilter === s ? ' active' : ''}`} onClick={() => setStyleFilter(s)}>{s}</button>
                  ))}
                </div>
              )}

              {/* Comparison table */}
              <div className="comp-table card">
                <div className="comp-table-header">
                  <span className="col-name">{swimmer.firstName}</span>
                  <span className="col-event">Gara</span>
                  <span className="col-name">{opponent.firstName}</span>
                </div>

                {filtered.map(({ event, swimmerA, swimmerB }) => {
                  const tA = timeToSeconds(swimmerA?.time)
                  const tB = timeToSeconds(swimmerB?.time)
                  const aWins = tA < tB
                  const bWins = tB < tA

                  return (
                    <div key={event} className={`comp-row${aWins ? ' a-wins' : bWins ? ' b-wins' : ''}`}>
                      <div className="col-time col-a">
                        <TimeCell record={swimmerA} winner={aWins} />
                      </div>
                      <div className="col-event-cell">
                        <span className="event-name">{event}</span>
                      </div>
                      <div className="col-time col-b">
                        <TimeCell record={swimmerB} winner={bWins} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
