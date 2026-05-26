import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/home',         icon: '🏠', label: 'Home'      },
  { to: '/rankings',     icon: '🏆', label: 'Classifiche' },
  { to: '/search',       icon: '🔍', label: 'Cerca'     },
  { to: '/competitions', icon: '🏅', label: 'Gare'      },
  { to: '/records',      icon: '📊', label: 'Primati'   },
]

export default function BottomNavigation() {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navigazione principale">
      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `bottom-nav-item${isActive ? ' active' : ''}`
          }
        >
          <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
