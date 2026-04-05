import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useSwimmer } from '../context/SwimmerContext'
import './Layout.css'

export default function Layout({ children }) {
  const { swimmer, selectSwimmer } = useSwimmer()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isSelectPage = pathname === '/'

  function handleLogout() {
    selectSwimmer(null)
    navigate('/')
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
            <button className="logout-btn" onClick={handleLogout} title="Cambia nuotatore">
              ⇄
            </button>
          </div>
        )}
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
        </nav>
      )}
    </div>
  )
}
