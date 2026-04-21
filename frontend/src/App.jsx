import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SwimmerProvider, useSwimmer } from './context/SwimmerContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import SelectSwimmer from './pages/SelectSwimmer'
import Dashboard from './pages/Dashboard'
import Scores from './pages/Scores'
import Compare from './pages/Compare'
import Records from './pages/Records'
import ComingSoon from './pages/ComingSoon'
import Profile from './pages/Profile'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireSwimmer({ children }) {
  const { swimmer } = useSwimmer()
  if (!swimmer) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route path="/*" element={
        <RequireAuth>
          <SwimmerProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<SelectSwimmer />} />
                <Route path="/dashboard" element={<RequireSwimmer><Dashboard /></RequireSwimmer>} />
                <Route path="/scores" element={<RequireSwimmer><Scores /></RequireSwimmer>} />
                <Route path="/compare" element={<RequireSwimmer><Compare /></RequireSwimmer>} />
                <Route path="/records" element={<RequireSwimmer><Records /></RequireSwimmer>} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/prossimamente" element={<RequireSwimmer><ComingSoon /></RequireSwimmer>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </SwimmerProvider>
        </RequireAuth>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
