import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { getMembership, isAppAdmin } from '@/lib/communication'
import logger from '@/lib/logger'

/**
 * Contexte de rôle dans un groupe. Trois niveaux : "admin" (un seul par groupe, tous droits),
 * "editor" (droit de modification : renommer + ajouter des membres, mais pas en retirer, ni
 * changer les rôles), "member" (aucun droit de gestion). Un admin/superadmin applicatif a
 * toujours les droits admin, quel que soit son rôle dans ce groupe précis.
 */
async function getGroupContext(conversationId: string, auth: { userId: string; role: string }) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conv || conv.type !== 'group') return null
  const membership = await getMembership(conversationId, auth.userId)
  if (!membership) return null
  const isAdmin = isAppAdmin(auth.role) || membership.role === 'admin'
  const isEditor = membership.role === 'editor'
  return { conv, membership, isAdmin, isEditor, canAddMembers: isAdmin || isEditor }
}

/** POST : ajoute des membres { memberIds: string[] } — admin ou droit de modification. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id: conversationId } = await params
    const ctx = await getGroupContext(conversationId, auth)
    if (!ctx || !ctx.canAddMembers) {
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

/**
 * PATCH : change le rôle d'un membre { userId, role: 'admin' | 'editor' | 'member' } — admin
 * du groupe (ou admin app) requis. Un groupe n'a jamais qu'un seul admin : passer quelqu'un
 * d'autre admin est un TRANSFERT — l'admin actuel du groupe redescend automatiquement simple
 * membre dans la même transaction. Le droit de modification ("editor"), lui, peut être accordé
 * à plusieurs membres en même temps.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id: conversationId } = await params
    const ctx = await getGroupContext(conversationId, auth)
    if (!ctx || !ctx.isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const targetUserId: string = typeof body.userId === 'string' ? body.userId : ''
    const role: string = ['admin', 'editor', 'member'].includes(body.role) ? body.role : ''
    if (!targetUserId || !role) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    const target = await getMembership(conversationId, targetUserId)
    if (!target) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
    }

    if (role === 'admin') {
      if (target.role === 'admin') {
        return NextResponse.json({ error: 'Ce membre est déjà administrateur' }, { status: 400 })
      }
      // Transfert : l'admin actuel (s'il y en a un) redevient simple membre, la cible devient admin.
      await prisma.$transaction([
        prisma.conversationMember.updateMany({
          where: { conversationId, role: 'admin' },
          data: { role: 'member' },
        }),
        prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId: targetUserId } },
          data: { role: 'admin' },
        }),
      ])
      return NextResponse.json({ data: { success: true }, error: null })
    }

    // role === 'editor' | 'member' : impossible de faire descendre l'admin actuel sans
    // remplaçant — il doit d'abord transférer son rôle à quelqu'un d'autre.
    if (target.role === 'admin') {
      return NextResponse.json(
        { error: "Transférez d'abord l'administration à quelqu'un d'autre" },
        { status: 400 }
      )
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

/**
 * DELETE ?userId=... : retire un membre. Un utilisateur peut toujours se retirer lui-même ;
 * retirer quelqu'un d'autre nécessite les droits admin (le droit de modification ne suffit
 * pas). L'admin du groupe ne peut pas quitter tant qu'il reste d'autres membres — il doit
 * d'abord transférer son rôle, sinon le groupe se retrouverait sans administrateur.
 */
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
    if (selfLeave) {
      const membership = await getMembership(conversationId, auth.userId)
      if (!membership) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
      if (membership.role === 'admin') {
        const memberCount = await prisma.conversationMember.count({ where: { conversationId } })
        if (memberCount > 1) {
          return NextResponse.json(
            { error: "Transférez d'abord l'administration avant de quitter le groupe" },
            { status: 400 }
          )
        }
      }
    } else {
      const ctx = await getGroupContext(conversationId, auth)
      if (!ctx || !ctx.isAdmin) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
      const target = await getMembership(conversationId, targetUserId)
      if (target?.role === 'admin') {
        return NextResponse.json(
          { error: "Transférez d'abord l'administration à quelqu'un d'autre" },
          { status: 400 }
        )
      }
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
