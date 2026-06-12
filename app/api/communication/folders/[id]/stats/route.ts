import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { canViewFolder, getRequestUser } from '@/lib/communication'
import logger from '@/lib/logger'

/**
 * GET /api/communication/folders/[id]/stats
 * Retourne les statistiques d'un dossier : nombre de sous-dossiers et fichiers directs, taille totale, accès.
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
    const folder = await prisma.folder.findUnique({ where: { id } })
    if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    if (!(await canViewFolder(folder, reqUser))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Collecte récursive de toute l'arborescence
    const allIds = await collectFolderTree(id)
    const [childFolderCount, files] = await Promise.all([
      prisma.folder.count({ where: { parentId: { in: allIds } } }),
      prisma.attachment.findMany({ where: { folderId: { in: allIds } }, select: { size: true } }),
    ])

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)

    let accessLabel = 'Tout le monde'
    if (folder.scope === 'group') {
      accessLabel = 'Groupe'
    } else if (folder.visibility === 'admins') {
      accessLabel = 'Administrateurs uniquement'
    } else if (folder.visibility === 'roles') {
      accessLabel = 'Rôles spécifiques'
    } else if (folder.visibility === 'users') {
      accessLabel = 'Personnes spécifiques'
    }

    return NextResponse.json({
      data: {
        folderCount: childFolderCount,
        fileCount: files.length,
        totalSize,
        scope: folder.scope,
        accessLabel,
        createdAt: folder.createdAt,
      },
      error: null,
    })
  } catch (error) {
    logger.error('Erreur GET folder stats', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function collectFolderTree(rootId: string): Promise<string[]> {
  const result = [rootId]
  let frontier = [rootId]
  while (frontier.length) {
    const children = await prisma.folder.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    })
    const ids = children.map((c) => c.id)
    result.push(...ids)
    frontier = ids
  }
  return result
}
