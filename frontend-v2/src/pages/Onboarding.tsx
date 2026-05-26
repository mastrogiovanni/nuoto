import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { searchSwimmers } from '../api'
import type { Swimmer, UserProfile } from '../types'

type Step = 'profile' | 'athlete'

export default function Onboarding() {
  const { setUserProfile, setAthlete, pendingProfile } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('profile')

  // Step 1 state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [registration, setRegistration] = useState('')
  const [profileError, setProfileError] = useState('')

  // Step 2 state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Swimmer[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pre-fill search with name from step 1
  useEffect(() => {
    if (step === 'athlete' && pendingProfile) {
      const lastName = pendingProfile.fullName.trim().split(/\s+/).slice(-1)[0]
      setQuery(lastName)
    }
  }, [step, pendingProfile])

  // Debounced athlete search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchSwimmers(query)
        setResults(data)
        setSearched(true)
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { setProfileError('Inserisci il tuo nome completo'); return }
    if (!email.trim() || !email.includes('@')) { setProfileError('Inserisci un\'email valida'); return }
    if (!registration.trim()) { setProfileError('Inserisci il numero di tesserino'); return }
    const profile: UserProfile = { fullName: fullName.trim(), email: email.trim(), registrationNumber: registration.trim() }
    setUserProfile(profile)
    setStep('athlete')
  }

  function handleSelectAthlete(swimmer: Swimmer) {
    setAthlete(swimmer)
    navigate('/home', { replace: true })
  }

  return (
    <div className="onboarding">
      <div className="onboarding-hero">
        <div className="onboarding-hero-icon">🏊‍♂️</div>
        <div className="onboarding-hero-title">Nuoto</div>
        <div className="onboarding-hero-subtitle">I tuoi tempi, i tuoi record</div>
      </div>

      <div className="onboarding-body">
        <div className="onboarding-card">
          {/* Step indicators */}
          <div className="step-indicators">
            <div className={`step-dot${step === 'profile' ? ' active' : ''}`} />
            <div className={`step-dot${step === 'athlete' ? ' active' : ''}`} />
          </div>

          {step === 'profile' ? (
            <>
              <div className="onboarding-step-title">Benvenuto!</div>
              <div className="onboarding-step-sub">Inserisci i tuoi dati per iniziare</div>
              <form className="onboarding-form" onSubmit={handleProfileSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">Nome e Cognome</label>
                  <input
                    id="fullName"
                    className="form-input"
                    type="text"
                    placeholder="Mario Rossi"
                    value={fullName}
                    onChange={e => { setFullName(e.target.value); setProfileError('') }}
                    autoComplete="name"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    className="form-input"
                    type="email"
                    placeholder="mario.rossi@esempio.it"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setProfileError('') }}
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="registration">Numero Tesserino FIN</label>
                  <input
                    id="registration"
                    className="form-input"
                    type="text"
                    placeholder="Es. 123456"
                    value={registration}
                    onChange={e => { setRegistration(e.target.value); setProfileError('') }}
                    inputMode="numeric"
                  />
                </div>
                {profileError && <div className="form-error">{profileError}</div>}
                <button type="submit" className="btn btn--primary btn--full">
                  Continua →
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="onboarding-step-title">Trova il tuo profilo</div>
              <div className="onboarding-step-sub">Cerca il tuo cognome nell'archivio FIN</div>
              <div className="search-bar" style={{ marginBottom: 16 }}>
                <span className="search-bar-icon">🔍</span>
                <input
                  className="search-bar-input"
                  type="search"
                  placeholder="Cognome..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
                {searching && <div className="search-spinner" />}
              </div>

              {searched && results.length === 0 && !searching && (
                <div className="no-results">Nessun atleta trovato per &ldquo;{query}&rdquo;</div>
              )}

              {results.length > 0 && (
                <ul className="swimmer-list">
                  {results.map(s => (
                    <li
                      key={s.id}
                      className="swimmer-item"
                      onClick={() => handleSelectAthlete(s)}
                    >
                      <div className="avatar">{s.initials}</div>
                      <div className="swimmer-details">
                        <span className="swimmer-fullname">{s.firstName} {s.lastName}</span>
                        <span className="swimmer-meta">{s.club} · {s.birthYear}</span>
                      </div>
                      <span className="swimmer-arrow">›</span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                className="btn btn--ghost btn--sm"
                style={{ marginTop: 16, width: '100%' }}
                onClick={() => setStep('profile')}
              >
                ← Torna indietro
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
