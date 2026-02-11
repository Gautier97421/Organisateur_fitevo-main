// Logger conditionnel pour la production
// En production, seuls les erreurs critiques seront loguées

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  // Log uniquement en développement
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  
  // Debug - uniquement en développement
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args)
    }
  },
  
  // Info - uniquement en développement
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args)
    }
  },
  
  // Warning - loggé en production aussi (sans détails sensibles)
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args)
    }
    // En production, on pourrait envoyer à un service de monitoring
  },
  
  // Erreur - toujours loggée mais sans exposer de détails sensibles
  error: (message: string, error?: any) => {
    if (isDevelopment) {
      console.error('[ERROR]', message, error)
    } else {
      // En production, logger le message sans stack trace détaillé
      console.error('[ERROR]', message)
      // Ici on pourrait envoyer à Sentry, LogRocket, etc.
    }
  },
  
  // Erreur critique - toujours loggée
  critical: (message: string, error?: any) => {
    console.error('[CRITICAL]', message)
    if (isDevelopment && error) {
      console.error(error)
    }
    // En production, envoyer une alerte
  }
}

// Export par défaut
export default logger
