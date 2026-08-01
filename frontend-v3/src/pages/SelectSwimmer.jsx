import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchSwimmers } from '../api'
import { useSwimmer } from '../context/SwimmerContext'
import './SelectSwimmer.css'

export default function SelectSwimmer() {
  const [surname, setSurname] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const { selectSwimmer } = useSwimmer()
  const navigate = useNavigate()
  const timerRef = useRef(null)
  const lastQueryRef = useRef(null)
  const lastRequestTimeRef = useRef(0)

  useEffect(() => {
    const trimmed = surname.trim()
    if (trimmed.length < 2) {
      clearTimeout(timerRef.current)
      setResults([])
      setSearched(false)
      return
    }
    if (trimmed === lastQueryRef.current) return
    clearTimeout(timerRef.current)
    const delay = Math.max(0, 1000 - (Date.now() - lastRequestTimeRef.current))
    timerRef.current = setTimeout(async () => {
      lastQueryRef.current = trimmed
      lastRequestTimeRef.current = Date.now()
      setLoading(true)
      try {
        const res = await searchSwimmers(trimmed)
        setResults(res)
        setSearched(true)
      } finally {
        setLoading(false)
      }
    }, delay)
    return () => clearTimeout(timerRef.current)
  }, [surname])

  function handleSelect(swimmer) {
    selectSwimmer(swimmer)
    navigate('/dashboard')
  }

  const isSearching = surname.length > 0

  return (
    <div className={`select-page${isSearching ? ' select-page--searching' : ''}`}>
      <div className={`select-hero${isSearching ? ' select-hero--collapsed' : ''}`}>
        <div className="hero-content">
          <div className="hero-icon">🌊</div>
          <h1 className="hero-title">Nuoto</h1>
          <p className="hero-subtitle">I tuoi tempi, i tuoi record</p>
        </div>
      </div>

      <div className="select-card card">
        <h2 className={`select-heading${isSearching ? ' select-heading--hidden' : ''}`}>Chi sei?</h2>
        <p className={`select-hint${isSearching ? ' select-hint--hidden' : ''}`}>Inserisci il tuo cognome per trovare il tuo profilo</p>

        <div className="search-box">
          <svg className="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Cerca per cognome..."
            value={surname}
            onChange={e => setSurname(e.target.value)}
            autoFocus
          />
          {loading && <span className="search-spinner" />}
        </div>

        {searched && results.length === 0 && !loading && (
          <p className="no-results">Nessun nuotatore trovato per &ldquo;{surname}&rdquo;</p>
        )}

        {results.length > 0 && (
          <ul className="swimmer-list">
            {results.map(s => (
              <li key={s.id} className="swimmer-item" onClick={() => handleSelect(s)}>
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
    </div>
  )
}
