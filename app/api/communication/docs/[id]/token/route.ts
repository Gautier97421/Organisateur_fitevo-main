import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { canAccessAttachment, getRequestUser } from '@/lib/communication'
import { signCollabToken } from '@/lib/collab-token'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

// Palette de couleurs déterministes pour les curseurs de collaboration.
const CURSOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b',
]

function colorFor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

/**
 * GET /api/communication/docs/[id]/token
 * Vérifie l'accès au document puis renvoie un jeton de connexion collaborative
 * (WebSocket Yjs) ainsi que l'identité d'affichage pour le curseur.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const reqUser = await getRequestUser(auth.userId)
    if (!reqUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 })

    const { id } = await params
    if (!(await canAccessAttachment(id, reqUser))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, name: true },
    })
    const name = user?.name || 'Utilisateur'

    const token = signCollabToken(id, auth.userId, name)
    if (!token) {
      return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
    }

    return NextResponse.json({
      data: {
        token,
        user: { id: auth.userId, name, color: colorFor(auth.userId) },
      },
      error: null,
    })
  } catch (error) {
    logger.error('Erreur jeton collaboratif', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
