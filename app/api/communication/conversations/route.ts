import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import logger from '@/lib/logger'

/**
 * GET /api/communication/conversations
 * Liste les conversations de l'utilisateur, avec le dernier message, les membres
 * et le nombre de messages non lus. Triées par activité récente.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const memberships = await prisma.conversationMember.findMany({
      where: { userId: auth.userId },
      include: {
        conversation: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true, role: true } } },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, name: true } } },
            },
          },
        },
      },
    })

    // Les superadmins sont invisibles pour les admins/employés.
    const hideSuperadmins = auth.role !== 'superadmin'

    const conversationsRaw = await Promise.all(
      memberships.map(async (m) => {
        const conv = m.conversation

        // Conversation directe avec un superadmin → totalement masquée
        if (hideSuperadmins && conv.type === 'direct') {
          const hasSuperadmin = conv.members.some(
            (mem) => mem.userId !== auth.userId && mem.user.role === 'superadmin'
          )
          if (hasSuperadmin) return null
        }

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: m.conversationId,
            deletedAt: null,
            senderId: { not: auth.userId },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        })

        const lastMessage = conv.messages[0] || null

        // Dans les groupes, on retire les superadmins de la liste des membres affichée
        const visibleMembers = hideSuperadmins
          ? conv.members.filter((mem) => mem.user.role !== 'superadmin')
          : conv.members

        return {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          lastMessageAt: conv.lastMessageAt,
          createdBy: conv.createdBy,
          myRole: m.role,
          unreadCount,
          members: visibleMembers.map((mem) => ({
            userId: mem.userId,
            role: mem.role,
            name: mem.user.name,
            email: mem.user.email,
            userRole: mem.user.role,
          })),
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                senderId: lastMessage.senderId,
                senderName: lastMessage.sender.name,
                hasAttachment: !!lastMessage.attachmentId,
                createdAt: lastMessage.createdAt,
              }
            : null,
          pinnedMessageId: conv.pinnedMessageId ?? null,
        }
      })
    )

    const conversations = conversationsRaw.filter(
      (c): c is NonNullable<typeof c> => c !== null
    )

    // Tri : activité récente (lastMessageAt) puis création
    conversations.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return tb - ta
    })

    return NextResponse.json({ data: conversations, error: null })
  } catch (error) {
    logger.error('Erreur GET conversations', error)
    return NextResponse.json({ data: null, error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/communication/conversations
 * Crée une conversation directe (dédupliquée) ou un groupe.
 * Body direct : { type: "direct", userId }
 * Body groupe : { type: "group", name, memberIds: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const type = body.type === 'group' ? 'group' : 'direct'

    if (type === 'direct') {
      const targetId: string = body.userId
      if (!targetId || typeof targetId !== 'string' || targetId === auth.userId) {
        return NextResponse.json({ error: 'Destinataire invalide' }, { status: 400 })
      }
      const target = await prisma.user.findFirst({ where: { id: targetId, active: true } })
      if (!target) {
        return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
      }
      // Un non-superadmin ne peut pas démarrer de conversation avec un superadmin
      if (target.role === 'superadmin' && auth.role !== 'superadmin') {
        return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
      }

      // Déduplication : conversation directe existante entre les deux
      const existing = await prisma.conversation.findFirst({
        where: {
          type: 'direct',
          AND: [
            { members: { some: { userId: auth.userId } } },
            { members: { some: { userId: targetId } } },
          ],
        },
      })
      if (existing) {
        return NextResponse.json({ data: { id: existing.id, created: false }, error: null })
      }

      const conv = await prisma.conversation.create({
        data: {
          type: 'direct',
          createdBy: auth.userId,
          members: {
            create: [
              { userId: auth.userId, role: 'member' },
              { userId: targetId, role: 'member' },
            ],
          },
        },
      })
      return NextResponse.json({ data: { id: conv.id, created: true }, error: null })
    }

    // type === 'group'
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Nom de groupe invalide (1-100 caractères)' }, { status: 400 })
    }
    const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : []
    // Membres uniques, actifs, hors créateur (ajouté en admin)
    const uniqueIds = [...new Set(memberIds.filter((id) => typeof id === 'string' && id !== auth.userId))]
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
        active: true,
        // Un non-superadmin ne peut pas ajouter de superadmin à un groupe
        ...(auth.role !== 'superadmin' ? { role: { not: 'superadmin' } } : {}),
      },
      select: { id: true },
    })
    const validIds = validUsers.map((u) => u.id)

    const conv = await prisma.conversation.create({
      data: {
        type: 'group',
        name,
        createdBy: auth.userId,
        members: {
          create: [
            { userId: auth.userId, role: 'admin' },
            ...validIds.map((id) => ({ userId: id, role: 'member' })),
          ],
        },
      },
    })
    return NextResponse.json({ data: { id: conv.id, created: true }, error: null })
  } catch (error) {
    logger.error('Erreur POST conversation', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
