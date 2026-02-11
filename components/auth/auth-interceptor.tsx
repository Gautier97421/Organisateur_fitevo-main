'use client'

import { useEffect } from 'react'
import { setupAuthInterceptor } from '@/lib/auth-fetch'

/**
 * Composant qui initialise l'intercepteur d'authentification
 * au chargement de l'application
 */
export function AuthInterceptor() {
  useEffect(() => {
    // Configurer l'intercepteur une seule fois au montage
    setupAuthInterceptor()
  }, [])
  
  return null
}
