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
      {!isSelectPage && <header className="top-bar">
        <div className="top-bar-brand">
          <span className="top-bar-icon">🏊</span>
          <span className="top-bar-title">Nuoto</span>
        </div>
        {swimmer && (
          <div className="top-bar-swimmer">
            <div className="avatar">{swimmer.avatarInitials}</div>
            <div className="swimmer-info">
              <span className="swimmer-name">{swimmer.firstName} {swimmer.name}</span>
              <span className="swimmer-club">{swimmer.club}</span>
            </div>
            <button className="logout-btn" onClick={handleSwitchSwimmer} title="Cambia nuotatore">
              ⇄
            </button>
          </div>
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
                Profile
              </button>
              <button className="user-menu-item user-menu-item-danger" onClick={handleLogoutClick} role="menuitem">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>}

      <main className={`main-content${isSelectPage ? ' no-padding' : ''}`}>{children}</main>

      {swimmer && (
        <nav className="bottom-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Home</span>
          </NavLink>
          <NavLink to="/scores" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">🏅</span>
            <span className="nav-label">Risultati</span>
          </NavLink>
          <NavLink to="/compare" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">⚡</span>
            <span className="nav-label">Confronta</span>
          </NavLink>
          <NavLink to="/records" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">🏆</span>
            <span className="nav-label">Primati</span>
          </NavLink>
        </nav>
      )}
    </div>
  )
}
