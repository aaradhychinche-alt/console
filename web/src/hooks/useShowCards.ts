import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to manage and persist the "show cards" / collapsed state for dashboards.
 * Cards are expanded by default, and the state is persisted to localStorage.
 *
 * @param storageKey - Unique key for localStorage persistence
 * @param defaultExpanded - Whether cards should be expanded by default (default: true)
 */
export function useShowCards(storageKey: string, defaultExpanded = true) {
  const fullKey = `${storageKey}:showCards`

  const [showCards, setShowCards] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(fullKey)
      // If nothing stored, use default (expanded)
      return stored !== null ? JSON.parse(stored) : defaultExpanded
    } catch {
      return defaultExpanded
    }
  })

  // Persist to localStorage when state changes
  useEffect(() => {
    localStorage.setItem(fullKey, JSON.stringify(showCards))
  }, [showCards, fullKey])

  const toggleShowCards = useCallback(() => {
    setShowCards(prev => !prev)
  }, [])

  const expandCards = useCallback(() => {
    setShowCards(true)
  }, [])

  const collapseCards = useCallback(() => {
    setShowCards(false)
  }, [])

  return {
    showCards,
    setShowCards,
    toggleShowCards,
    expandCards,
    collapseCards,
  }
}
