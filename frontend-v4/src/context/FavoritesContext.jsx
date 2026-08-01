import { createContext, useContext, useState, useCallback } from 'react'

const FavoritesContext = createContext(null)

function load() {
  try {
    return JSON.parse(localStorage.getItem('sr_favorites') || '[]')
  } catch {
    return []
  }
}

function save(list) {
  localStorage.setItem('sr_favorites', JSON.stringify(list))
}

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(load)

  const addFavorite = useCallback((swimmer) => {
    setFavorites(prev => {
      if (prev.some(f => f.key === swimmer.key)) return prev
      const next = [swimmer, ...prev]
      save(next)
      return next
    })
  }, [])

  const removeFavorite = useCallback((key) => {
    setFavorites(prev => {
      const next = prev.filter(f => f.key !== key)
      save(next)
      return next
    })
  }, [])

  const isFavorite = useCallback((key) => {
    return favorites.some(f => f.key === key)
  }, [favorites])

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  return useContext(FavoritesContext)
}
