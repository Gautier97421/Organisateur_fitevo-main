import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { getMembership } from '@/lib/communication'
import logger from '@/lib/logger'

/**
 * PATCH /api/communication/conversations/[id]/read
 * Marque la conversation comme lue (met à jour lastReadAt du membre).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const { id: conversationId } = await params
    const membership = await getMembership(conversationId, auth.userId)
    if (!membership) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { lastReadAt: new Date() },
    })

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur PATCH read', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
