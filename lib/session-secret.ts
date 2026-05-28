import logger from '@/lib/logger'

const DEVELOPMENT_SESSION_SECRET = 'fitevo-dev-session-secret-change-me'

export function getSessionSecret(): string | null {
  const configuredSecret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET

  if (configuredSecret) {
    return configuredSecret
  }

  if (process.env.NODE_ENV !== 'production') {
    logger.warn('SESSION_SECRET/NEXTAUTH_SECRET absent, utilisation du secret de developpement')
    return DEVELOPMENT_SESSION_SECRET
  }

  return null
}