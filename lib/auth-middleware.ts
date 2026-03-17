/**
 * Middleware d'authentification pour les routes API
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * Vérifie l'authentification d'une requête
 * Retourne l'userId si authentifié, null sinon
 */
export async function verifyAuth(request: NextRequest): Promise<string | null> {
  try {
    // Récupérer l'userId depuis les headers
    const userId = request.headers.get('x-user-id')
    const userEmail = request.headers.get('x-user-email')
    
    if (!userId && !userEmail) {
      return null
    }
    
    // Vérifier que l'utilisateur existe et est actif
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          userId ? { id: userId } : {},
          userEmail ? { email: userEmail } : {}
        ].filter(condition => Object.keys(condition).length > 0),
        active: true
      }
    })
    
    if (!user) {
      // Fallback: certains comptes admin existent dans la table `admins`.
      if (userEmail) {
        const adminByEmail = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id::text AS id
          FROM admins
          WHERE email = ${userEmail}
          LIMIT 1
        `

        if (adminByEmail.length > 0) {
          return adminByEmail[0].id
        }
      }

      if (userId) {
        const adminById = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id::text AS id
          FROM admins
          WHERE id::text = ${userId}
          LIMIT 1
        `

        if (adminById.length > 0) {
          return adminById[0].id
        }
      }

      return null
    }
    
    return user.id
  } catch (error) {
    logger.error('Erreur vérification auth', error)
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
