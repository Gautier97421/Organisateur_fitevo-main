/**
 * Middleware d'authentification pour les routes API
 * Vérifie le cookie de session signé HMAC-SHA256 (pas les headers client)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySessionCookie } from '@/lib/session'
import logger from '@/lib/logger'

/**
 * Vérifie l'authentification d'une requête via le cookie de session signé
 * Retourne l'userId si authentifié, null sinon
 */
export async function verifyAuth(request: NextRequest): Promise<string | null> {
  const sessionCookie = request.cookies.get('fitevo_session')
  const payload = verifySessionCookie(sessionCookie?.value)
  return payload?.id || null
}

/**
 * Vérifie l'authentification et retourne userId + role
 */
export async function verifyAuthWithRole(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const sessionCookie = request.cookies.get('fitevo_session')
  const payload = verifySessionCookie(sessionCookie?.value)
  if (!payload) return null
  return { userId: payload.id, role: payload.role }
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
