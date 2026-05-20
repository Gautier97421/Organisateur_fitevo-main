/**
 * Helper pour les requêtes fetch avec authentification automatique
 * L'authentification repose sur le cookie de session HttpOnly (envoyé automatiquement same-origin)
 */

/**
 * Fetch authentifié — les cookies de session sont envoyés automatiquement pour les
 * requêtes same-origin. Ne plus injecter x-user-id / x-user-email (headers client-contrôlables).
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, { credentials: 'same-origin', ...options })
}

/**
 * Installe l'intercepteur global fetch.
 * Plus besoin d'injecter des headers d'identité : le cookie HttpOnly est transmis
 * automatiquement par le navigateur pour toutes les requêtes same-origin.
 */
export function setupAuthInterceptor() {
  // No-op : l'authentification est portée par le cookie de session signé.
}
