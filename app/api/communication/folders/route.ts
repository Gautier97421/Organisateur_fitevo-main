import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { canViewFolder, getRequestUser, isAppAdmin, isMember } from '@/lib/communication'
import logger from '@/lib/logger'

/**
 * GET /api/communication/folders
 * Vue unifiée : retourne TOUS les dossiers racine accessibles à l'utilisateur
 * (partagés filtrés par visibilité + dossiers de tous les groupes dont il est membre).
 * Chaque dossier de groupe inclut un champ `conversationName` pour l'affichage.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const reqUser = await getRequestUser(auth.userId)
    if (!reqUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 })

    const [sharedFolders, memberships] = await Promise.all([
      prisma.folder.findMany({
        where: { scope: 'shared', parentId: null },
        orderBy: { name: 'asc' },
      }),
      prisma.conversationMember.findMany({
        where: { userId: auth.userId },
        include: { conversation: { select: { id: true, name: true, type: true } } },
      }),
    ])

    // Dossiers partagés filtrés par visibilité
    const visibleShared: Array<typeof sharedFolders[0] & { conversationName: null }> = []
    for (const f of sharedFolders) {
      if (await canViewFolder(f, reqUser)) visibleShared.push({ ...f, conversationName: null })
    }

    // Dossiers de groupe pour tous les groupes de l'utilisateur
    const groupConvIds = memberships
      .filter((m) => m.conversation.type === 'group')
      .map((m) => m.conversation.id)

    const convNameMap = new Map(
      memberships
        .filter((m) => m.conversation.type === 'group')
        .map((m) => [m.conversation.id, m.conversation.name || 'Groupe'])
    )

    const groupFoldersRaw = groupConvIds.length
      ? await prisma.folder.findMany({
          where: { scope: 'group', conversationId: { in: groupConvIds }, parentId: null },
          orderBy: { name: 'asc' },
        })
      : []

    const visibleGroup = groupFoldersRaw.map((f) => ({
      ...f,
      conversationName: f.conversationId ? (convNameMap.get(f.conversationId) ?? 'Groupe') : null,
    }))

    return NextResponse.json({ data: [...visibleShared, ...visibleGroup], error: null })
  } catch (error) {
    logger.error('Erreur GET folders', error)
    return NextResponse.json({ data: null, error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/communication/folders
 * Dossier partagé : { scope:"shared", name, visibility, roleIds?, userIds?, parentId? } — admin requis.
 * Dossier de groupe : { scope:"group", conversationId, name, parentId? } — membre requis.
 * Sous-dossier : parentId défini → hérite du scope du parent (envoyé par le client).
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const body = await request.json()
    const scope = body.scope === 'group' ? 'group' : 'shared'
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Nom invalide (1-100 caractères)' }, { status: 400 })
    }
    const parentId: string | null = typeof body.parentId === 'string' ? body.parentId : null

    if (scope === 'shared') {
      if (!isAppAdmin(auth.role)) {
        return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
      }
      const visibility = ['all', 'admins', 'roles', 'users'].includes(body.visibility) ? body.visibility : 'all'
      const roleIds = visibility === 'roles' && Array.isArray(body.roleIds) ? body.roleIds : null
      const userIds = visibility === 'users' && Array.isArray(body.userIds) ? body.userIds : null

      const folder = await prisma.folder.create({
        data: { name, scope: 'shared', visibility, roleIds, userIds, parentId, createdBy: auth.userId },
      })
      return NextResponse.json({ data: folder, error: null })
    }

    // scope === 'group'
    const conversationId: string = body.conversationId
    if (!conversationId || !(await isMember(conversationId, auth.userId))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    const folder = await prisma.folder.create({
      data: { name, scope: 'group', conversationId, parentId, createdBy: auth.userId },
    })
    return NextResponse.json({ data: folder, error: null })
  } catch (error) {
    logger.error('Erreur POST folder', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
