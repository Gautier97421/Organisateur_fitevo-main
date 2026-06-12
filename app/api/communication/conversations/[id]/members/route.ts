import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { getMembership, isAppAdmin } from '@/lib/communication'
import logger from '@/lib/logger'

/** Vérifie que l'appelant peut administrer le groupe (admin du groupe ou admin app). */
async function canManage(conversationId: string, auth: { userId: string; role: string }) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conv || conv.type !== 'group') return null
  const membership = await getMembership(conversationId, auth.userId)
  const allowed = isAppAdmin(auth.role) || membership?.role === 'admin'
  if (!membership || !allowed) return null
  return conv
}

/** POST : ajoute des membres { memberIds: string[] } */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id: conversationId } = await params
    if (!(await canManage(conversationId, auth))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : []
    const uniqueIds = [...new Set(memberIds.filter((id) => typeof id === 'string'))]
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
        active: true,
        // Un non-superadmin ne peut pas ajouter de superadmin à un groupe
        ...(auth.role !== 'superadmin' ? { role: { not: 'superadmin' } } : {}),
      },
      select: { id: true },
    })

    await prisma.$transaction(
      validUsers.map((u) =>
        prisma.conversationMember.upsert({
          where: { conversationId_userId: { conversationId, userId: u.id } },
          create: { conversationId, userId: u.id, role: 'member' },
          update: {},
        })
      )
    )

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur POST members', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** PATCH : change le rôle d'un membre { userId, role: 'admin' | 'member' } — admin requis. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id: conversationId } = await params
    if (!(await canManage(conversationId, auth))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const targetUserId: string = typeof body.userId === 'string' ? body.userId : ''
    const role: string = body.role === 'admin' ? 'admin' : body.role === 'member' ? 'member' : ''
    if (!targetUserId || !role) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    const target = await getMembership(conversationId, targetUserId)
    if (!target) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
    }

    // Empêcher de retirer le dernier admin du groupe
    if (role === 'member' && target.role === 'admin') {
      const adminCount = await prisma.conversationMember.count({
        where: { conversationId, role: 'admin' },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Le groupe doit conserver au moins un administrateur' },
          { status: 400 }
        )
      }
    }

    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
      data: { role },
    })

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur PATCH members', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** DELETE ?userId=... : retire un membre. Un utilisateur peut se retirer lui-même. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id: conversationId } = await params
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId') || auth.userId

    const selfLeave = targetUserId === auth.userId
    if (!selfLeave && !(await canManage(conversationId, auth))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    if (selfLeave && !(await getMembership(conversationId, auth.userId))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    await prisma.conversationMember.deleteMany({
      where: { conversationId, userId: targetUserId },
    })

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur DELETE members', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
