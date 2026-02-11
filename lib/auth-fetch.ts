/**
 * Helper pour les requêtes fetch avec authentification automatique
 */

/**
 * Fetch avec headers d'authentification automatiques
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Récupérer les infos d'auth depuis localStorage
  const userId = localStorage.getItem('userId')
  const userEmail = localStorage.getItem('userEmail')
  
  // Ajouter les headers d'authentification
  const headers = new Headers(options.headers || {})
  
  if (userId) {
    headers.set('x-user-id', userId)
  }
  
  if (userEmail) {
    headers.set('x-user-email', userEmail)
  }
  
  // Fusionner les options
  const authenticatedOptions: RequestInit = {
    ...options,
    headers
  }
  
  return fetch(url, authenticatedOptions)
}

/**
 * Wrapper global pour remplacer fetch par authenticatedFetch
 * À appeler au démarrage de l'application
 */
export function setupAuthInterceptor() {
  if (typeof window !== 'undefined') {
    const originalFetch = window.fetch
    
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      // Ne pas intercepter les requêtes externes
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      
      // Seulement pour les requêtes vers nos APIs
      if (url.startsWith('/api/')) {
        const userId = localStorage.getItem('userId')
        const userEmail = localStorage.getItem('userEmail')
        
        const headers = new Headers(init?.headers || {})
        
        if (userId) {
          headers.set('x-user-id', userId)
        }
        
        if (userEmail) {
          headers.set('x-user-email', userEmail)
        }
        
        const newInit: RequestInit = {
          ...init,
          headers
        }
        
        return originalFetch(input, newInit)
      }
      
      // Appeler le fetch original pour les autres requêtes
      return originalFetch(input, init)
    }
  }
}
