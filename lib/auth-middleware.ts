/**
 * Middleware d'authentification pour les routes API
 * Vérifie le cookie de session signé HMAC-SHA256 (pas les headers client)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

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
 * Vérifie l'authentification d'une requête via le cookie de session signé
 * Retourne l'userId si authentifié, null sinon
 */
export async function verifyAuth(request: NextRequest): Promise<string | null> {
  try {
    const sessionCookie = request.cookies.get('fitevo_session')
    if (!sessionCookie?.value) return null

    const parts = sessionCookie.value.split(':')
    if (parts.length !== 2) return null

    const [hexPayload, hmac] = parts
    const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET
    if (!secret) return null

    const isValid = verifyHmac(hexPayload, hmac, secret)
    if (!isValid) return null

    const payload = JSON.parse(decodeHex(hexPayload))
    return payload.id || null
  } catch {
    return null
  }
}

/**
 * Vérifie l'authentification et retourne userId + role
 */
export async function verifyAuthWithRole(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  try {
    const sessionCookie = request.cookies.get('fitevo_session')
    if (!sessionCookie?.value) return null

    const parts = sessionCookie.value.split(':')
    if (parts.length !== 2) return null

    const [hexPayload, hmac] = parts
    const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET
    if (!secret) return null

    const isValid = verifyHmac(hexPayload, hmac, secret)
    if (!isValid) return null

    const payload = JSON.parse(decodeHex(hexPayload))
    if (!payload.id) return null
    return { userId: payload.id, role: payload.role }
  } catch {
    return null
  }
}

/**
 * Middleware pour protéger une route
 * Retourne une réponse 401 si non authentifié
 */
export async function requireAuth(
  request: NextRequest,
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const userId = await verifyAuth(request)
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }
  
  return handler(request, userId)
}

/**
 * Vérifie si l'utilisateur a le rôle requis
 */
export async function hasRole(userId: string, requiredRoles: string[]): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })
    
    if (!user) {
      return false
    }
    
    return requiredRoles.includes(user.role)
  } catch (error) {
    logger.error('Erreur vérification rôle', error)
    return false
  }
}

/**
 * Middleware pour vérifier le rôle
 */
export async function requireRole(
  request: NextRequest,
  requiredRoles: string[],
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const userId = await verifyAuth(request)
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }
  
  const authorized = await hasRole(userId, requiredRoles)
  
  if (!authorized) {
    return NextResponse.json(
      { error: 'Accès refusé' },
      { status: 403 }
    )
  }
  
  return handler(request, userId)
}
