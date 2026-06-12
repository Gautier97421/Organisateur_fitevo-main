/**
 * Source unique de l'identité de l'utilisateur côté client.
 *
 * Conformité RGPD : les données personnelles (email, nom, rôle) ne sont plus
 * stockées durablement dans le localStorage (persistance indéfinie + lisible).
 * Elles sont dérivées du cookie de session signé via /api/me, mises en cache
 * en mémoire et, au plus, dans le sessionStorage — lequel est effacé à la
 * fermeture de l'onglet (limitation de conservation, Art. 5.1.e).
 *
 * Le cookie HttpOnly reste l'unique source d'autorité côté serveur ; ces
 * valeurs ne servent qu'à l'affichage et à pré-remplir des requêtes.
 */

export interface CurrentUser {
  id: string
  email: string
  name: string
  username: string | null
  role: string
  profilePhoto: string | null
  isSuperAdmin: boolean
}

const STORAGE_KEY = "fitevo_user"

let cache: CurrentUser | null = null

/**
 * Récupère l'utilisateur depuis /api/me et alimente le cache.
 * À appeler au montage des pages protégées (admin, employé).
 */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await fetch("/api/me")
    if (!res.ok) {
      clearCurrentUser()
      return null
    }
    const data = await res.json()
    cache = data.user as CurrentUser
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    }
    return cache
  } catch {
    return null
  }
}

/**
 * Accès synchrone à l'utilisateur en cache (mémoire puis sessionStorage).
 * Retourne null si l'identité n'a pas encore été chargée.
 */
export function getCurrentUser(): CurrentUser | null {
  if (cache) return cache
  if (typeof window !== "undefined") {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        cache = JSON.parse(raw) as CurrentUser
      } catch {
        /* ignore */
      }
    }
  }
  return cache
}

/** Efface l'identité en cache (à la déconnexion). */
export function clearCurrentUser(): void {
  cache = null
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY)
  }
}

// Accesseurs synchrones — remplacent les anciens localStorage.getItem(...)
export const getUserId = (): string => getCurrentUser()?.id ?? ""
export const getUserEmail = (): string => getCurrentUser()?.email ?? ""
export const getUserName = (): string => getCurrentUser()?.name ?? ""
export const getUserRole = (): string => getCurrentUser()?.role ?? ""
export const getIsSuperAdmin = (): boolean => getCurrentUser()?.isSuperAdmin ?? false
