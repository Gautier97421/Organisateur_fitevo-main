import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-middleware'

/**
 * Retourne les informations de l'utilisateur courant à partir du cookie de
 * session signé (HttpOnly). Permet au client de ne plus stocker de données
 * personnelles (email, nom, rôle) dans le localStorage — conformité RGPD
 * (Art. 32, minimisation de l'exposition des données personnelles).
 */
export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      profilePhoto: true,
      active: true,
    },
  })

  if (!user || !user.active) {
    return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      profilePhoto: user.profilePhoto,
      isSuperAdmin: user.role === 'superadmin',
    },
  })
}
