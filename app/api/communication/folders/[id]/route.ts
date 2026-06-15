import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { canViewFolder, getRequestUser, isAppAdmin, resolveStoredPath } from '@/lib/communication'
import logger from '@/lib/logger'

/**
 * GET /api/communication/folders/[id]
 * Contenu d'un dossier (sous-dossiers + fichiers) si l'utilisateur peut le voir.
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

    const [children, attachments] = await Promise.all([
      prisma.folder.findMany({ where: { parentId: id }, orderBy: { name: 'asc' } }),
      prisma.attachment.findMany({
        where: { folderId: id },
        orderBy: { uploadedAt: 'desc' },
      }),
    ])

    // Noms des uploaders
    const uploaderIds = [...new Set(attachments.map((a) => a.uploadedBy))]
    const uploaders = await prisma.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, name: true },
    })
    const nameById = new Map(uploaders.map((u) => [u.id, u.name]))

    return NextResponse.json({
      data: {
        folder,
        children,
        files: attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          size: a.size,
          uploadedBy: a.uploadedBy,
          uploaderName: nameById.get(a.uploadedBy) || 'Inconnu',
          uploadedAt: a.uploadedAt,
        })),
      },
      error: null,
    })
  } catch (error) {
    logger.error('Erreur GET folder', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/communication/folders/[id]
 * Modifie le nom et/ou la visibilité d'un dossier.
 * Partagé → admin app uniquement. Groupe → créateur ou admin app (nom uniquement).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id } = await params
    const folder = await prisma.folder.findUnique({ where: { id } })
    if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const allowed = isAppAdmin(auth.role) || folder.createdBy === auth.userId
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (name.length < 1 || name.length > 100) {
        return NextResponse.json({ error: 'Nom invalide (1-100 caractères)' }, { status: 400 })
      }
      updates.name = name
    }

    // Modification du partage (dossiers partagés uniquement).
    if (folder.scope === 'shared' && body.visibility !== undefined) {
      if (isAppAdmin(auth.role)) {
        // Admin : choix complet.
        if (['all', 'admins', 'roles', 'users'].includes(body.visibility)) {
          updates.visibility = body.visibility
          updates.roleIds = body.visibility === 'roles' && Array.isArray(body.roleIds) ? body.roleIds : null
          updates.userIds = body.visibility === 'users' && Array.isArray(body.userIds) ? body.userIds : null
        }
      } else if (folder.createdBy === auth.userId) {
        // Créateur non-admin : peut uniquement gérer le partage avec des personnes.
        updates.visibility = 'users'
        updates.roleIds = null
        updates.userIds = Array.isArray(body.userIds)
          ? body.userIds.filter((u: unknown) => typeof u === 'string')
          : []
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
    }

    const updated = await prisma.folder.update({ where: { id }, data: updates })
    return NextResponse.json({ data: updated, error: null })
  } catch (error) {
    logger.error('Erreur PATCH folder', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/communication/folders/[id]
 * Supprime un dossier (cascade enfants). Partagé → admin app. Groupe → créateur ou admin app.
 * Les fichiers physiques rattachés sont supprimés.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id } = await params
    const folder = await prisma.folder.findUnique({ where: { id } })
    if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const allowed =
      folder.scope === 'shared'
        ? isAppAdmin(auth.role)
        : isAppAdmin(auth.role) || folder.createdBy === auth.userId
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    // Récupérer tous les fichiers de l'arborescence pour suppression disque
    const descendantIds = await collectFolderTree(id)
    const files = await prisma.attachment.findMany({
      where: { folderId: { in: descendantIds } },
      select: { storedName: true },
    })

    // Supprimer d'abord les enregistrements de fichiers (sinon SetNull les orpheliniserait)
    await prisma.attachment.deleteMany({ where: { folderId: { in: descendantIds } } })
    await prisma.folder.delete({ where: { id } }) // cascade DB sur les sous-dossiers

    // Suppression physique best-effort
    for (const f of files) {
      const p = resolveStoredPath(f.storedName)
      if (p) await fs.unlink(p).catch(() => {})
    }

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur DELETE folder', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** Collecte récursivement les IDs d'un dossier et de ses descendants. */
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
