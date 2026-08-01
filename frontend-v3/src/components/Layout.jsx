import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useSwimmer } from '../context/SwimmerContext'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

export default function Layout({ children }) {
  const { swimmer, selectSwimmer } = useSwimmer()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isSelectPage = pathname === '/'
  const [isUserMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const userInitials = useMemo(() => {
    if (!user?.name) return 'U'
    const parts = user.name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'U'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
  }, [user])

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleDocumentClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [isUserMenuOpen])

  function handleSwitchSwimmer() {
    selectSwimmer(null)
    navigate('/')
  }

  function handleProfileClick() {
    setUserMenuOpen(false)
    navigate('/profile')
  }

  function handleLogoutClick() {
    setUserMenuOpen(false)
    selectSwimmer(null)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      {!isSelectPage && (
        <header className="top-bar">
          <div className="top-bar-brand">
            <span className="top-bar-wave">🌊</span>
            <span className="top-bar-title">Nuoto</span>
          </div>

          {swimmer && (
            <button className="swimmer-chip" onClick={handleSwitchSwimmer} title="Cambia nuotatore">
              <div className="swimmer-chip-avatar">{swimmer.avatarInitials}</div>
              <div className="swimmer-chip-info">
                <span className="swimmer-chip-name">{swimmer.firstName} {swimmer.name}</span>
                <span className="swimmer-chip-club">{swimmer.club}</span>
              </div>
              <span className="swimmer-chip-switch">⇄</span>
            </button>
          )}

          <div className="top-bar-user" ref={userMenuRef}>
            <button
              className="user-avatar-btn"
              onClick={() => setUserMenuOpen(open => !open)}
              title={user?.name ?? 'Utente'}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
            >
              {userInitials}
            </button>
            {isUserMenuOpen && (
              <div className="user-menu" role="menu">
                <button className="user-menu-item" onClick={handleProfileClick} role="menuitem">
                  Profilo
                </button>
                <button className="user-menu-item user-menu-item-danger" onClick={handleLogoutClick} role="menuitem">
                  Esci
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <main className={`main-content${isSelectPage ? ' no-padding' : ''}`}>{children}</main>

      {swimmer && (
        <nav className="bottom-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span className="nav-label">Home</span>
          </NavLink>
          <NavLink to="/scores" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="6"/>
              <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
            <span className="nav-label">Risultati</span>
          </NavLink>
          <NavLink to="/compare" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
            <span className="nav-label">Confronta</span>
          </NavLink>
          <NavLink to="/records" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="nav-label">Primati</span>
          </NavLink>
        </nav>
      )}
    </div>
  )
}
