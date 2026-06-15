/**
 * Jeton d'accès à un document collaboratif.
 *
 * Émis par une route API après vérification des droits (accès au dossier), puis
 * présenté lors de la connexion WebSocket Yjs (`/api/collab`). Le serveur
 * (`server.js`) le vérifie sans accès base de données.
 *
 * Format (identique au cookie de session) : `${hexPayload}:${hmacHex}`.
 * Signé en HMAC-SHA256 avec le secret de session.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getSessionSecret } from '@/lib/session-secret'

interface CollabTokenPayload {
  docId: string
  userId: string
  name: string
  exp: number // epoch seconds
}

const TOKEN_TTL_SECONDS = 60 * 60 // 1 h

export function signCollabToken(docId: string, userId: string, name: string): string | null {
  const secret = getSessionSecret()
  if (!secret) return null
  const payload: CollabTokenPayload = {
    docId,
    userId,
    name,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  const hexPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('hex')
  const hmac = createHmac('sha256', secret).update(hexPayload).digest('hex')
  return `${hexPayload}:${hmac}`
}

export function verifyCollabToken(token: string, docId: string): CollabTokenPayload | null {
  try {
    const secret = getSessionSecret()
    if (!secret) return null
    const parts = token.split(':')
    if (parts.length !== 2) return null
    const [hexPayload, hmac] = parts
    const expected = createHmac('sha256', secret).update(hexPayload).digest('hex')
    const a = Buffer.from(hmac, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(hexPayload, 'hex').toString('utf-8')) as CollabTokenPayload
    if (!payload || payload.docId !== docId) return null
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
