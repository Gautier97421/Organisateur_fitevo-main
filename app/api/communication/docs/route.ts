import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { canViewFolder, ensureUploadDir, getRequestUser, isMember } from '@/lib/communication'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

// Type MIME interne identifiant un document collaboratif (éditeur Tiptap/Yjs).
export const COLLAB_DOC_MIME = 'application/vnd.fitevo-doc'

/**
 * POST /api/communication/docs  { name, folderId }
 * Crée un document collaboratif (texte riche) dans un dossier visible.
 * Stocké comme pièce jointe avec un type MIME dédié ; l'état Yjs vit à part.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const reqUser = await getRequestUser(auth.userId)
    if (!reqUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 })

    const body = await request.json()
    const folderId = typeof body?.folderId === 'string' ? body.folderId : ''
    const rawName = typeof body?.name === 'string' ? body.name : ''

    if (!folderId) {
      return NextResponse.json({ error: 'Dossier requis' }, { status: 400 })
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId } })
    if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    if (!(await canViewFolder(folder, reqUser))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    if (folder.scope === 'group' && folder.conversationId) {
      if (!(await isMember(folder.conversationId, auth.userId))) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    // Nom d'affichage assaini (jamais utilisé comme chemin).
    const displayName = (rawName.replace(/[\r\n\t]/g, ' ').trim().slice(0, 200)) || 'Nouveau document'
    const storedName = `${randomUUID()}.fdoc`

    const dir = await ensureUploadDir()
    // Fichier d'export HTML initial (vide) — sert au téléchargement/aperçu.
    await fs.writeFile(path.join(dir, storedName), '')

    const attachment = await prisma.attachment.create({
      data: {
        fileName: displayName,
        storedName,
        mimeType: COLLAB_DOC_MIME,
        size: 0,
        folderId,
        uploadedBy: auth.userId,
      },
    })

    return NextResponse.json({
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        folderId: attachment.folderId,
      },
      error: null,
    })
  } catch (error) {
    logger.error('Erreur création document collaboratif', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
