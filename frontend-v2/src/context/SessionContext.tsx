import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { Session, UserProfile, Swimmer } from '../types'

const SESSION_KEY = 'nuoto_session_v1'

interface SessionContextValue {
  session: Session | null
  athlete: Swimmer | null
  pendingProfile: UserProfile | null
  isOnboarded: boolean
  setUserProfile: (profile: UserProfile) => void
  setAthlete: (athlete: Swimmer) => void
  clearAthlete: () => void
  logout: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession)
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null)

  function setUserProfile(profile: UserProfile) {
    setPendingProfile(profile)
  }

  function setAthlete(athlete: Swimmer) {
    const user = pendingProfile ?? session?.user
    if (!user) return
    const next: Session = { user, athlete }
    setSession(next)
    setPendingProfile(null)
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
  }

  function clearAthlete() {
    if (!session) return
    const next: Session = { ...session, athlete: session.athlete }
    setSession(null)
    setPendingProfile(session.user)
    localStorage.removeItem(SESSION_KEY)
    // Re-enter athlete selection keeping user profile
    setPendingProfile(next.user)
  }

  function logout() {
    setSession(null)
    setPendingProfile(null)
    localStorage.removeItem(SESSION_KEY)
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        athlete: session?.athlete ?? null,
        pendingProfile,
        isOnboarded: session !== null,
        setUserProfile,
        setAthlete,
        clearAthlete,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
