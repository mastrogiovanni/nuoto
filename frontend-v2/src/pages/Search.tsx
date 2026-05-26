import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchSwimmers } from '../api'
import type { Swimmer } from '../types'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'

export default function Search() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Swimmer[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchSwimmers(query.trim())
        setResults(data)
        setSearched(true)
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return (
    <div className="page-content">
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Cerca Atleta</h1>
        <p className="page-subtitle">Cerca per cognome o nome</p>
      </div>

      <div className="search-bar" style={{ marginBottom: 16 }}>
        <span className="search-bar-icon">🔍</span>
        <input
          className="search-bar-input"
          type="search"
          placeholder="Cognome o nome..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        {searching && <div className="search-spinner" />}
      </div>

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="search-hint">Digita almeno 2 caratteri</p>
      )}

      {searching && <LoadingState text="Ricerca in corso..." />}

      {!searching && searched && results.length === 0 && (
        <EmptyState
          icon="🏊"
          title="Nessun atleta trovato"
          subtitle={`Nessun risultato per "${query}"`}
        />
      )}

      {!searching && results.length > 0 && (
        <>
          <p className="result-count-label">{results.length} atleti trovati</p>
          <div className="swimmer-list-page">
            {results.map(s => (
              <div
                key={s.id}
                className="athlete-card"
                onClick={() => navigate(`/search/athlete/${s.id}`)}
              >
                <div className="avatar">{s.initials}</div>
                <div className="athlete-card-info">
                  <div className="athlete-card-name">{s.firstName} {s.lastName}</div>
                  <div className="athlete-card-meta">
                    {s.club} · {s.category} · {s.birthYear}
                  </div>
                </div>
                <span className="athlete-card-arrow">›</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!searching && !searched && (
        <div className="search-placeholder">
          <div className="search-placeholder-icon">🔍</div>
          <div className="search-placeholder-text">
            Inizia a digitare per cercare atleti nell'archivio FIN
          </div>
        </div>
      )}
    </div>
  )
}
