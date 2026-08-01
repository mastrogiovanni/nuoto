import { createContext, useContext, useState, useCallback } from 'react'

const FavoritesContext = createContext(null)

function loadAthletes() {
  try { return JSON.parse(localStorage.getItem('sr5_favorites') || '[]') } catch { return [] }
}

function saveAthletes(list) {
  localStorage.setItem('sr5_favorites', JSON.stringify(list))
}

function loadWatched() {
  try { return JSON.parse(localStorage.getItem('sr5_watched_races') || '[]') } catch { return [] }
}

function saveWatched(list) {
  localStorage.setItem('sr5_watched_races', JSON.stringify(list))
}

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(loadAthletes)
  const [watchedRaces, setWatchedRaces] = useState(loadWatched)

  const addFavorite = useCallback((swimmer) => {
    setFavorites(prev => {
      if (prev.some(f => f.key === swimmer.key)) return prev
      const next = [swimmer, ...prev]
      saveAthletes(next)
      return next
    })
  }, [])

  const removeFavorite = useCallback((key) => {
    setFavorites(prev => {
      const next = prev.filter(f => f.key !== key)
      saveAthletes(next)
      return next
    })
  }, [])

  const isFavorite = useCallback((key) => {
    return favorites.some(f => f.key === key)
  }, [favorites])

  const addWatchedRace = useCallback((race) => {
    // race: { id, label, year, style, distance, gender, category }
    setWatchedRaces(prev => {
      if (prev.some(r => r.id === race.id)) return prev
      const next = [race, ...prev]
      saveWatched(next)
      return next
    })
  }, [])

  const removeWatchedRace = useCallback((id) => {
    setWatchedRaces(prev => {
      const next = prev.filter(r => r.id !== id)
      saveWatched(next)
      return next
    })
  }, [])

  return (
    <FavoritesContext.Provider value={{
      favorites, addFavorite, removeFavorite, isFavorite,
      watchedRaces, addWatchedRace, removeWatchedRace,
    }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  return useContext(FavoritesContext)
}
