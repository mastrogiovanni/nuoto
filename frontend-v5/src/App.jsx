import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FavoritesProvider } from './context/FavoritesContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import AthleteProfile from './pages/AthleteProfile'
import Ranking from './pages/Ranking'
import Events from './pages/Events'
import Compare from './pages/Compare'
import Favorites from './pages/Favorites'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/*" element={
        <RequireAuth>
          <FavoritesProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/athlete/:key" element={<AthleteProfile />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/events" element={<Events />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </FavoritesProvider>
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
