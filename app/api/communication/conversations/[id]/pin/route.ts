import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { isMember } from '@/lib/communication'
import logger from '@/lib/logger'

/** PATCH : épingle un message { messageId } — membre requis. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id: conversationId } = await params
    if (!(await isMember(conversationId, auth.userId))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const messageId: string | null = typeof body.messageId === 'string' ? body.messageId : null

    if (messageId) {
      const msg = await prisma.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true, deletedAt: true },
      })
      if (!msg || msg.conversationId !== conversationId || msg.deletedAt) {
        return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })
      }
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { pinnedMessageId: messageId },
    })

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur PATCH pin', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
