import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
  // undefined = still loading; null = unauthenticated; object = authenticated user
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) {
          setUser(data)
        } else {
          localStorage.removeItem('auth_token')
          setToken(null)
          setUser(null)
        }
      })
      .catch(() => setUser(null))
  }, [token])

  function login(newToken) {
    localStorage.setItem('auth_token', newToken)
    setToken(newToken)
  }

  function logout() {
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
