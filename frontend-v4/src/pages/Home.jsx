import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchAthletes } from '../api'
import { toSwimmer } from '../utils'
import { useFavorites } from '../context/FavoritesContext'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function AthleteRow({ athlete, onClick }) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()
  const swimmer = toSwimmer(athlete)
  const fav = isFavorite(swimmer.key)

  function toggleFav(e) {
    e.stopPropagation()
    if (fav) removeFavorite(swimmer.key)
    else addFavorite(swimmer)
  }

  return (
    <div className="athlete-row" onClick={onClick}>
      <div className="athlete-avatar">{swimmer.initials}</div>
      <div className="athlete-info">
        <div className="athlete-name">{swimmer.displayName}</div>
        <div className="athlete-meta">{swimmer.club} · {swimmer.birthYear} · {swimmer.sex}</div>
      </div>
      <button className="fav-btn" onClick={toggleFav} title={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}>
        {fav ? '⭐' : '☆'}
      </button>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { favorites } = useFavorites()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef(null)
  const debouncedQuery = useDebounce(query, 180)

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    setSearching(true)
    searchAthletes(debouncedQuery)
      .then(data => {
        setResults(data)
        setSearched(true)
      })
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  const goToProfile = useCallback((key) => {
    navigate(`/athlete/${encodeURIComponent(key)}`)
  }, [navigate])

  const showFavorites = query.trim().length < 2

  return (
    <div className="page">
      {/* Header */}
      <div style={{ paddingTop: 4 }}>
        <h1 className="page-title">Cerca nuotatori</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginTop: 4 }}>
          Cerca per nome, cognome o società
        </p>
      </div>

      {/* Search bar */}
      <div className="search-wrap">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder="Es. Mario Rossi, Aurelia Nuoto…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button className="search-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }}>✕</button>
        )}
      </div>

      {/* Loading */}
      {searching && (
        <div className="loading-center" style={{ padding: '24px' }}>
          <span className="spinner spinner--sm" />
        </div>
      )}

      {/* Search results */}
      {!searching && searched && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {results.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <p>Nessun risultato per <strong>"{debouncedQuery}"</strong></p>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 16px 6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {results.length} risultati
              </div>
              {results.map(a => (
                <AthleteRow key={a.key} athlete={a} onClick={() => goToProfile(a.key)} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Favorites quick access */}
      {showFavorites && favorites.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="section-title">⭐ I tuoi preferiti</h2>
            <button className="see-all-btn" onClick={() => navigate('/favorites')}>Vedi tutti →</button>
          </div>
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {favorites.slice(0, 5).map(s => (
              <div key={s.key} className="athlete-row" onClick={() => goToProfile(s.key)}>
                <div className="athlete-avatar">{s.initials}</div>
                <div className="athlete-info">
                  <div className="athlete-name">{s.displayName || s.name}</div>
                  <div className="athlete-meta">{s.club} · {s.birthYear}</div>
                </div>
                <svg style={{ width: 18, color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick nav cards */}
      {showFavorites && (
        <section>
          <h2 className="section-title" style={{ marginBottom: 10 }}>Esplora</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <QuickCard icon="🏆" label="Classifiche" sub="Per gara e competizione" onClick={() => navigate('/ranking')} color="#DBEAFE" />
            <QuickCard icon="🥇" label="Primati" sub="Record italiani" onClick={() => navigate('/records')} color="#FEF3C7" />
            <QuickCard icon="⚖️" label="Confronta" sub="Affianca due nuotatori" onClick={() => navigate('/compare')} color="#D1FAE5" />
            <QuickCard icon="⭐" label="Preferiti" sub="I tuoi nuotatori" onClick={() => navigate('/favorites')} color="#FDE8FF" />
          </div>
        </section>
      )}
    </div>
  )
}

function QuickCard({ icon, label, sub, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: color,
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'opacity 0.15s',
      }}
    >
      <span style={{ fontSize: '1.6rem' }}>{icon}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{sub}</span>
    </button>
  )
}
