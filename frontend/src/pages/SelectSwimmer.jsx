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
  const debounceRef = useRef(null)

  useEffect(() => {
    if (surname.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchSwimmers(surname)
        setResults(res)
        setSearched(true)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [surname])

  function handleSelect(swimmer) {
    selectSwimmer(swimmer)
    navigate('/dashboard')
  }

  return (
    <div className="select-page">
      <div className="select-hero">
        <div className="hero-wave" />
        <div className="hero-content">
          <div className="hero-icon">🏊‍♂️</div>
          <h1 className="hero-title">Nuoto</h1>
          <p className="hero-subtitle">I tuoi tempi, i tuoi record</p>
        </div>
      </div>

      <div className="select-card">
        <h2 className="select-heading">Chi sei?</h2>
        <p className="select-hint">Inserisci il tuo cognome per trovare il tuo profilo</p>

        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="Cognome..."
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
                <span className="swimmer-arrow">›</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
