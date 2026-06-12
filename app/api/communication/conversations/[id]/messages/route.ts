import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { isMember } from '@/lib/communication'
import logger from '@/lib/logger'

/**
 * GET /api/communication/conversations/[id]/messages?before=<cursor>&limit=30
 * Historique paginé par curseur (descendant) — membre requis.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const { id: conversationId } = await params
    if (!(await isMember(conversationId, auth.userId))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const before = searchParams.get('before') // id du message le plus ancien déjà chargé
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10) || 30, 50)

    // Pagination par curseur sur createdAt décroissant
    let cursorClause = {}
    if (before) {
      const cursorMsg = await prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      })
      if (cursorMsg) {
        cursorClause = { createdAt: { lt: cursorMsg.createdAt } }
      }
    }

    const messages = await prisma.message.findMany({
      where: { conversationId, deletedAt: null, ...cursorClause },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        sender: { select: { id: true, name: true } },
        attachment: {
          select: { id: true, fileName: true, mimeType: true, size: true },
        },
      },
    })

    const hasMore = messages.length > limit
    const page = hasMore ? messages.slice(0, limit) : messages

    // Renvoyé en ordre chronologique croissant pour l'affichage
    const ordered = page.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender.name,
      content: m.content,
      attachment: m.attachment,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
    }))

    return NextResponse.json({
      data: ordered,
      nextCursor: hasMore ? page[0]?.id : null,
      error: null,
    })
  } catch (error) {
    logger.error('Erreur GET messages', error)
    return NextResponse.json({ data: null, error: 'Erreur serveur' }, { status: 500 })
  }
}
