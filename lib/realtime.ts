/**
 * Registre temps réel partagé (WebSocket).
 *
 * Le serveur custom ([server.js]) et les route handlers Next tournent dans le
 * MÊME processus Node. On partage donc un registre de connexions via `globalThis`
 * (clé unique) afin que :
 *   - server.js y enregistre/retire les sockets WS à la connexion/déconnexion,
 *   - les routes API y poussent des messages via `broadcastToUsers(...)`.
 *
 * Aucune dépendance externe (pas de Redis) : suffisant pour une instance unique,
 * cohérent avec le rate-limiting en mémoire déjà utilisé dans le projet.
 */

const GLOBAL_KEY = '__fitevoRealtime'

interface RealtimeRegistry {
  // userId -> ensemble de sockets ouvertes (un utilisateur peut avoir plusieurs onglets)
  connections: Map<string, Set<any>>
}

function getRegistry(): RealtimeRegistry {
  const g = globalThis as any
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { connections: new Map<string, Set<any>>() }
  }
  return g[GLOBAL_KEY] as RealtimeRegistry
}

/** Enregistre une socket pour un utilisateur. */
export function register(userId: string, socket: any): void {
  const { connections } = getRegistry()
  let set = connections.get(userId)
  if (!set) {
    set = new Set()
    connections.set(userId, set)
  }
  set.add(socket)
}

/** Retire une socket (déconnexion). */
export function unregister(userId: string, socket: any): void {
  const { connections } = getRegistry()
  const set = connections.get(userId)
  if (!set) return
  set.delete(socket)
  if (set.size === 0) connections.delete(userId)
}

/**
 * Pousse un payload JSON aux utilisateurs ciblés (ceux qui sont connectés).
 * `readyState === 1` correspond à WebSocket.OPEN — on évite d'importer `ws` ici.
 */
export function broadcastToUsers(userIds: string[], payload: unknown): void {
  const { connections } = getRegistry()
  const data = JSON.stringify(payload)
  const unique = new Set(userIds)
  for (const userId of unique) {
    const set = connections.get(userId)
    if (!set) continue
    for (const socket of set) {
      try {
        if (socket.readyState === 1) socket.send(data)
      } catch {
        // socket défaillante : ignorée, sera nettoyée au close
      }
    }
  }
}

/** Indique si un utilisateur a au moins une connexion active (présence). */
export function isOnline(userId: string): boolean {
  const { connections } = getRegistry()
  const set = connections.get(userId)
  return !!set && set.size > 0
}
