/**
 * Vérification du cookie de session signé (HMAC-SHA256).
 *
 * Fonction pure réutilisable hors d'un contexte NextRequest :
 *  - par les middlewares d'API ([lib/auth-middleware.ts]),
 *  - par le serveur WebSocket custom ([server.js]) lors de l'upgrade.
 *
 * Le cookie a la forme `<hexPayload>:<hmacHex>` où hexPayload est le JSON
 * `{ id, role }` encodé en hex.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getSessionSecret } from '@/lib/session-secret'

export interface SessionPayload {
  id: string
  role: string
}

function decodeHex(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf-8')
}

function verifyHmac(hexPayload: string, signatureHex: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(hexPayload).digest('hex')
    const sigBuf = Buffer.from(signatureHex, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return false
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

/**
 * Vérifie la valeur brute d'un cookie de session.
 * Retourne le payload { id, role } si valide, null sinon.
 */
export function verifySessionCookie(cookieValue: string | undefined | null): SessionPayload | null {
  try {
    if (!cookieValue) return null

    const parts = cookieValue.split(':')
    if (parts.length !== 2) return null

    const [hexPayload, hmac] = parts
    const secret = getSessionSecret()
    if (!secret) return null

    if (!verifyHmac(hexPayload, hmac, secret)) return null

    const payload = JSON.parse(decodeHex(hexPayload))
    if (!payload || typeof payload.id !== 'string') return null

    return { id: payload.id, role: typeof payload.role === 'string' ? payload.role : '' }
  } catch {
    return null
  }
}

/**
 * Extrait la valeur du cookie `fitevo_session` depuis un header Cookie brut.
 * Utilisé par le serveur WebSocket (pas d'accès à l'API cookies de Next).
 */
export function extractSessionCookie(cookieHeader: string | undefined | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=')
    if (name === 'fitevo_session') {
      const raw = rest.join('=')
      try { return decodeURIComponent(raw) } catch { return raw }
    }
  }
  return null
}
