import { useEffect, useRef, useCallback } from "react"

/**
 * Hook pour rafraîchir automatiquement les données toutes les X secondes
 * @param callback - Fonction à appeler pour rafraîchir les données
 * @param interval - Intervalle en millisecondes (défaut: 30000ms = 30s, 0 = désactivé)
 * @param dependencies - Dépendances qui déclenchent un rechargement immédiat
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  interval: number = 30000,
  dependencies: any[] = []
) {
  const savedCallback = useRef<() => void | Promise<void>>(callback)
  const intervalId = useRef<NodeJS.Timeout | undefined>(undefined)

  // Sauvegarder la dernière callback
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // Fonction pour exécuter le callback
  const tick = useCallback(async () => {
    if (savedCallback.current) {
      await savedCallback.current()
    }
  }, [])

  // Configurer l'intervalle
  useEffect(() => {
    // Appeler immédiatement au montage et quand les dépendances changent
    tick()

    // Configurer l'intervalle seulement si interval > 0
    if (interval > 0) {
      intervalId.current = setInterval(tick, interval)
    }

    // Nettoyer l'intervalle au démontage
    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current)
      }
    }
  }, [interval, tick, ...dependencies])

  // Retourner une fonction pour forcer un refresh manuel
  return useCallback(() => {
    tick()
  }, [tick])
}
