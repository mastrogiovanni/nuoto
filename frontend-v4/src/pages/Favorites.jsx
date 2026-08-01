import { useNavigate } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'

export default function Favorites() {
  const navigate = useNavigate()
  const { favorites, removeFavorite } = useFavorites()

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Preferiti</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: 4 }}>
          {favorites.length > 0
            ? `${favorites.length} nuotator${favorites.length === 1 ? 'e' : 'i'} salvat${favorites.length === 1 ? 'o' : 'i'}`
            : 'Nessun preferito ancora — cerca un nuotatore e premi ☆'}
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">⭐</span>
          <p>Aggiungi i tuoi nuotatori preferiti per trovarli subito qui.</p>
          <button
            onClick={() => navigate('/')}
            style={{ marginTop: 8, background: 'var(--primary)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.9rem' }}
          >
            Cerca nuotatori
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {favorites.map((s, i) => (
            <div
              key={s.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < favorites.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer', minWidth: 0 }}
                onClick={() => navigate(`/athlete/${encodeURIComponent(s.key)}`)}
              >
                <div className="athlete-avatar">{s.initials}</div>
                <div className="athlete-info">
                  <div className="athlete-name">{s.displayName || s.name}</div>
                  <div className="athlete-meta">{s.club} · {s.birthYear} · {s.sex}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => navigate(`/compare?a=${encodeURIComponent(s.key)}`)}
                  title="Confronta"
                  style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ⚖️
                </button>
                <button
                  onClick={() => removeFavorite(s.key)}
                  title="Rimuovi dai preferiti"
                  style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: '#FEE2E2', color: '#EF4444', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {favorites.length > 0 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Tocca un nuotatore per vedere il profilo completo
        </p>
      )}
    </div>
  )
}
