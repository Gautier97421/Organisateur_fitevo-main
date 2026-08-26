/**
 * Signature et vérification du cookie de session (HMAC-SHA256).
 *
 * Fonctions pures réutilisables hors d'un contexte NextRequest :
 *  - par les middlewares d'API ([lib/auth-middleware.ts]),
 *  - par le serveur WebSocket custom ([server.js]) lors de l'upgrade.
 *
 * Le cookie a la forme `<hexPayload>:<hmacHex>` où hexPayload est le JSON
 * `{ id, role, iat, exp }` encodé en hex.
 *
 * L'expiration est DANS la charge signée : le `maxAge` du cookie n'est qu'une
 * consigne au navigateur, qu'un attaquant ayant exfiltré la valeur du cookie
 * ignore complètement. Sans `exp` signé, un cookie volé restait valable
 * indéfiniment.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getSessionSecret } from '@/lib/session-secret'

/** Durée de vie d'une session, en secondes (8 h). */
export const SESSION_TTL_SECONDS = 8 * 60 * 60

export interface SessionPayload {
  id: string
  role: string
  /** Émission (epoch secondes). */
  iat?: number
  /** Expiration (epoch secondes). */
  exp?: number
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
 * Fabrique la valeur d'un cookie de session signé, expiration incluse.
 * Retourne null si aucun secret n'est configuré (erreur de déploiement).
 */
export function signSessionCookie(id: string, role: string): string | null {
  const secret = getSessionSecret()
  if (!secret) return null

  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { id, role, iat: now, exp: now + SESSION_TTL_SECONDS }
  const hexPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('hex')
  const hmac = createHmac('sha256', secret).update(hexPayload).digest('hex')
  return `${hexPayload}:${hmac}`
}

/**
 * Vérifie la valeur brute d'un cookie de session.
 * Retourne le payload { id, role } si valide et non expiré, null sinon.
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

    // Une session sans expiration signée est un cookie de l'ancien format : refusée,
    // sinon la protection se contournerait en rejouant un ancien cookie.
    if (typeof payload.exp !== 'number' || Math.floor(Date.now() / 1000) >= payload.exp) return null

    return {
      id: payload.id,
      role: typeof payload.role === 'string' ? payload.role : '',
      iat: payload.iat,
      exp: payload.exp,
    }
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
