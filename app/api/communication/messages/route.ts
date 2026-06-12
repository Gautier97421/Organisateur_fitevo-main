import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { getMembership } from '@/lib/communication'
import { broadcastToUsers } from '@/lib/realtime'
import logger from '@/lib/logger'

const MAX_CONTENT_LENGTH = 5000

// Rate limiting en mémoire (anti-flood) — fenêtre glissante par utilisateur
const sendTimestamps = new Map<string, number[]>()
const RL_WINDOW = 10_000 // 10 s
const RL_MAX = 30 // 30 messages / 10 s

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const arr = (sendTimestamps.get(userId) || []).filter((t) => now - t < RL_WINDOW)
  if (arr.length >= RL_MAX) {
    sendTimestamps.set(userId, arr)
    return false
  }
  arr.push(now)
  sendTimestamps.set(userId, arr)
  return true
}

// Nettoyage périodique pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now()
  for (const [key, arr] of sendTimestamps.entries()) {
    const kept = arr.filter((t) => now - t < RL_WINDOW)
    if (kept.length === 0) sendTimestamps.delete(key)
    else sendTimestamps.set(key, kept)
  }
}, 60_000)

/**
 * POST /api/communication/messages
 * Body : { conversationId, content?, attachmentId? }
 * Persiste le message, met à jour lastMessageAt et pousse via WebSocket aux membres.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const conversationId: string = body.conversationId
    const content: string = typeof body.content === 'string' ? body.content.trim() : ''
    const attachmentId: string | undefined =
      typeof body.attachmentId === 'string' ? body.attachmentId : undefined

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation manquante' }, { status: 400 })
    }
    if (!content && !attachmentId) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 })
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: 'Message trop long' }, { status: 400 })
    }

    // Autorisation : membre de la conversation
    const membership = await getMembership(conversationId, auth.userId)
    if (!membership) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Anti-flood
    if (!checkRateLimit(auth.userId)) {
      return NextResponse.json({ error: 'Trop de messages, ralentissez.' }, { status: 429 })
    }

    // Vérifier que la pièce jointe appartient bien à l'utilisateur (uploadée par lui)
    if (attachmentId) {
      const att = await prisma.attachment.findUnique({ where: { id: attachmentId } })
      if (!att || att.uploadedBy !== auth.userId) {
        return NextResponse.json({ error: 'Pièce jointe invalide' }, { status: 400 })
      }
    }

    const now = new Date()
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: auth.userId,
        content: content || '',
        attachmentId: attachmentId || null,
      },
      include: {
        sender: { select: { id: true, name: true } },
        attachment: { select: { id: true, fileName: true, mimeType: true, size: true } },
      },
    })

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    })


    const payloadMessage = {
      id: message.id,
      conversationId,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      attachment: message.attachment,
      createdAt: message.createdAt,
    }

    // Diffusion temps réel à tous les membres connectés
    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    })
    broadcastToUsers(
      members.map((m) => m.userId),
      { type: 'message', message: payloadMessage }
    )

    return NextResponse.json({ data: payloadMessage, error: null })
  } catch (error) {
    logger.error('Erreur POST message', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
