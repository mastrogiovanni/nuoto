import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function IconSearch() {
  return (
    <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function IconTrophy() {
  return (
    <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function IconCompare() {
  return (
    <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6"/>
    </svg>
  )
}

function IconStar() {
  return (
    <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const initials = (() => {
    if (!user?.name) return 'U'
    const parts = user.name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'U'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
  })()

  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-brand">
          <span className="top-bar-wave">🌊</span>
          <div>
            <div>SwimRank</div>
          </div>
        </div>

        <div className="user-menu-wrap" ref={menuRef}>
          <button
            className="user-avatar-btn"
            onClick={() => setMenuOpen(o => !o)}
            title={user?.name ?? 'Profilo'}
          >
            {user?.picture
              ? <img src={user.picture} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </button>

          {menuOpen && (
            <div className="user-menu">
              {user?.name && (
                <div className="user-menu-item" style={{ fontWeight: 700, cursor: 'default', color: 'var(--text-sub)', fontSize: '0.8rem', borderBottom: '1px solid var(--border)' }}>
                  {user.name}
                </div>
              )}
              <button className="user-menu-item user-menu-item--danger" onClick={handleLogout}>
                Esci
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        {children}
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconSearch />
          <span>Cerca</span>
        </NavLink>
        <NavLink to="/ranking" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconTrophy />
          <span>Classifica</span>
        </NavLink>
        <NavLink to="/events" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconCalendar />
          <span>Gare</span>
        </NavLink>
        <NavLink to="/compare" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconCompare />
          <span>Confronta</span>
        </NavLink>
        <NavLink to="/favorites" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconStar />
          <span>Preferiti</span>
        </NavLink>
      </nav>
    </div>
  )
}
