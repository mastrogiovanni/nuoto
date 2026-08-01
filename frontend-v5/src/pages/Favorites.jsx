import { useNavigate } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'

export default function Favorites() {
  const navigate = useNavigate()
  const { favorites, removeFavorite, watchedRaces, removeWatchedRace } = useFavorites()

  const hasAny = favorites.length > 0 || watchedRaces.length > 0

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Preferiti</h1>
        <p className="page-subtitle">I tuoi atleti seguiti e le gare monitorate</p>
      </div>

      {!hasAny ? (
        <div className="empty-state">
          <span className="empty-icon">⭐</span>
          <p>Nessun preferito ancora.</p>
          <p style={{ fontSize: '0.82rem', marginTop: 4 }}>
            Cerca un nuotatore e premi ☆, oppure salva una classifica dalla sezione Classifiche.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={() => navigate('/')}
              style={{ background: 'var(--primary)', color: 'white', padding: '10px 18px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.88rem' }}
            >
              Cerca nuotatori
            </button>
            <button
              onClick={() => navigate('/ranking')}
              style={{ background: 'var(--primary-xlight)', color: 'var(--primary)', padding: '10px 18px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.88rem' }}
            >
              Classifiche
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Followed athletes */}
          {favorites.length > 0 && (
            <section>
              <div className="section-header">
                <h2 className="section-title">Atleti seguiti</h2>
                <span className="pill">{favorites.length}</span>
              </div>
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
                        style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--primary-xlight)', color: 'var(--primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ⚖️
                      </button>
                      <button
                        onClick={() => removeFavorite(s.key)}
                        title="Rimuovi"
                        style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: '#FEE2E2', color: '#DC2626', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                Tocca un atleta per vedere il profilo completo
              </p>
            </section>
          )}

          {/* Watched races */}
          {watchedRaces.length > 0 && (
            <section>
              <div className="section-header">
                <h2 className="section-title">Gare monitorate</h2>
                <span className="pill">{watchedRaces.length}</span>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {watchedRaces.map((r, i) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      borderBottom: i < watchedRaces.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => navigate(`/ranking?style=${encodeURIComponent(r.style)}&distance=${r.distance}&gender=${r.gender}&category=${encodeURIComponent(r.category || '')}&season=${r.season}`)}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        🏆 {r.distance}m {r.style}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {r.gender === 'M' ? 'Maschile' : 'Femminile'}{r.category ? ' · ' + r.category : ''} · {r.season}
                      </div>
                    </div>
                    <button
                      onClick={() => removeWatchedRace(r.id)}
                      title="Rimuovi"
                      style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: '#FEE2E2', color: '#DC2626', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                Tocca una gara per aprire la classifica
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
