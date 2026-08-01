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
        <div className="athlete-meta">{swimmer.club} · {swimmer.birthYear} · {swimmer.sex === 'M' ? 'M' : 'F'}</div>
      </div>
      <button className="fav-btn" onClick={toggleFav} title={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}>
        {fav ? '⭐' : '☆'}
      </button>
    </div>
  )
}

function QuickCard({ icon, label, sub, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: accent,
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'opacity 0.15s, transform 0.1s',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform = ''}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      <span style={{ fontSize: '1.6rem' }}>{icon}</span>
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      <span style={{ fontSize: '0.73rem', color: 'var(--text-sub)', lineHeight: 1.3 }}>{sub}</span>
    </button>
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
      .then(data => { setResults(data); setSearched(true) })
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  const goToProfile = useCallback((key) => {
    navigate(`/athlete/${encodeURIComponent(key)}`)
  }, [navigate])

  const showFavorites = query.trim().length < 2

  return (
    <div className="page">
      <div style={{ paddingTop: 4 }}>
        <h1 className="page-title">Cerca nuotatori</h1>
        <p className="page-subtitle">Per nome, cognome o società</p>
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

      {searching && (
        <div className="loading-center" style={{ padding: '20px' }}>
          <span className="spinner spinner--sm" />
        </div>
      )}

      {!searching && searched && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {results.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <p>Nessun risultato per <strong>"{debouncedQuery}"</strong></p>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 16px 6px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                <svg style={{ width: 18, color: 'var(--text-muted)', flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            ))}
          </div>
        </section>
      )}

      {showFavorites && (
        <section>
          <h2 className="section-title" style={{ marginBottom: 12 }}>Esplora</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <QuickCard icon="🏆" label="Classifiche" sub="Stagione per stagione" onClick={() => navigate('/ranking')} accent="#E0F2FE" />
            <QuickCard icon="📅" label="Manifestazioni" sub="Archivio gare e risultati" onClick={() => navigate('/events')} accent="#F0FDF4" />
            <QuickCard icon="⚖️" label="Confronta" sub="Affianca due nuotatori" onClick={() => navigate('/compare')} accent="#FEF9EE" />
            <QuickCard icon="⭐" label="Preferiti" sub="I tuoi atleti seguiti" onClick={() => navigate('/favorites')} accent="#FDF4FF" />
          </div>
        </section>
      )}
    </div>
  )
}
