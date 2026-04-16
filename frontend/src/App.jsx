import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SwimmerProvider, useSwimmer } from './context/SwimmerContext'
import Layout from './components/Layout'
import SelectSwimmer from './pages/SelectSwimmer'
import Dashboard from './pages/Dashboard'
import Scores from './pages/Scores'
import Compare from './pages/Compare'
import ComingSoon from './pages/ComingSoon'

function ProtectedRoute({ children }) {
  const { swimmer } = useSwimmer()
  if (!swimmer) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SelectSwimmer />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/scores" element={
          <ProtectedRoute><Scores /></ProtectedRoute>
        } />
        <Route path="/compare" element={
          <ProtectedRoute><Compare /></ProtectedRoute>
        } />
        <Route path="/prossimamente" element={
          <ProtectedRoute><ComingSoon /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SwimmerProvider>
        <AppRoutes />
      </SwimmerProvider>
    </BrowserRouter>
  )
}
