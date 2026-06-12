import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { isMember } from '@/lib/communication'
import logger from '@/lib/logger'

/**
 * GET /api/communication/conversations/[id]/attachments
 * Retourne toutes les pièces jointes du fil, ordonnées par date décroissante.
 */
export async function GET(
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

    const messages = await prisma.message.findMany({
      where: { conversationId, deletedAt: null, attachmentId: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true } },
        attachment: { select: { id: true, fileName: true, mimeType: true, size: true } },
      },
    })

    const data = messages
      .filter((m) => m.attachment)
      .map((m) => ({
        messageId: m.id,
        sentAt: m.createdAt,
        senderName: m.sender.name,
        attachment: m.attachment!,
      }))

    return NextResponse.json({ data, error: null })
  } catch (error) {
    logger.error('Erreur GET attachments', error)
    return NextResponse.json({ data: null, error: 'Erreur serveur' }, { status: 500 })
  }
}
