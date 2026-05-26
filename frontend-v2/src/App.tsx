import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { SessionProvider, useSession } from './context/SessionContext'
import BottomNavigation from './components/BottomNavigation'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Rankings from './pages/Rankings'
import RankingDetail from './pages/RankingDetail'
import Search from './pages/Search'
import AthleteProfile from './pages/AthleteProfile'
import CompetitionsList, { CompetitionDetail } from './pages/Competitions'
import Records from './pages/Records'

// Pages that show the header bar
const HEADER_PATHS = ['/home', '/rankings', '/search', '/competitions', '/records']

function AppHeader() {
  const { athlete } = useSession()
  const { pathname } = useLocation()
  const showHeader = HEADER_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (!showHeader) return null
  return (
    <header className="top-bar">
      <div className="top-bar-brand">
        <span className="top-bar-brand-icon">🏊</span>
        <span>Nuoto</span>
      </div>
      <div className="top-bar-spacer" />
      {athlete && (
        <div className="top-bar-swimmer-chip">
          <div className="avatar avatar--sm">{athlete.initials}</div>
          <span className="top-bar-swimmer-name">{athlete.firstName} {athlete.lastName}</span>
        </div>
      )}
    </header>
  )
}

function RequireSession({ children }: { children: React.ReactNode }) {
  const { isOnboarded } = useSession()
  if (!isOnboarded) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { isOnboarded } = useSession()
  const { pathname } = useLocation()
  const showNav = isOnboarded && pathname !== '/onboarding'

  return (
    <div className="app-shell">
      <AppHeader />
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />

        <Route path="/" element={<RequireSession><Navigate to="/home" replace /></RequireSession>} />
        <Route path="/home" element={<RequireSession><Home /></RequireSession>} />

        <Route path="/rankings" element={<RequireSession><Rankings /></RequireSession>} />
        <Route path="/rankings/:year/:event" element={<RequireSession><RankingDetail /></RequireSession>} />

        <Route path="/search" element={<RequireSession><Search /></RequireSession>} />
        <Route path="/search/athlete/:id" element={<RequireSession><AthleteProfile /></RequireSession>} />

        <Route path="/competitions" element={<RequireSession><CompetitionsList /></RequireSession>} />
        <Route path="/competitions/:id" element={<RequireSession><CompetitionDetail /></RequireSession>} />

        <Route path="/records" element={<RequireSession><Records /></RequireSession>} />

        <Route path="*" element={<Navigate to={isOnboarded ? '/home' : '/onboarding'} replace />} />
      </Routes>
      {showNav && <BottomNavigation />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  )
}
