import { createContext, useContext, useState } from 'react'

const SwimmerContext = createContext(null)

export function SwimmerProvider({ children }) {
  const [swimmer, setSwimmer] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedSwimmer')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  function selectSwimmer(s) {
    setSwimmer(s)
    if (s) localStorage.setItem('selectedSwimmer', JSON.stringify(s))
    else localStorage.removeItem('selectedSwimmer')
  }

  return (
    <SwimmerContext.Provider value={{ swimmer, selectSwimmer }}>
      {children}
    </SwimmerContext.Provider>
  )
}

export function useSwimmer() {
  return useContext(SwimmerContext)
}
