import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_SIZE,
  canViewFolder,
  ensureUploadDir,
  getRequestUser,
  isMember,
} from '@/lib/communication'
import { compressImageIfPossible } from '@/lib/image-compression'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * POST /api/communication/upload  (multipart/form-data)
 * Champs : file (requis), folderId? (dépôt dans un dossier visible).
 * Sans folderId : fichier destiné à une pièce jointe de message (rattaché plus tard).
 * Renvoie l'Attachment créé.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const reqUser = await getRequestUser(auth.userId)
    if (!reqUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 })

    const form = await request.formData()
    const file = form.get('file')
    const folderId = form.get('folderId')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 25 Mo)' }, { status: 400 })
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 400 })
    }

    // Si dépôt dans un dossier : vérifier le droit de voir/déposer
    if (typeof folderId === 'string' && folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } })
      if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
      const canView = await canViewFolder(folder, reqUser)
      if (!canView) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      // Dossier de groupe : double check appartenance
      if (folder.scope === 'group' && folder.conversationId) {
        if (!(await isMember(folder.conversationId, auth.userId))) {
          return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }
      }
    }

    // Nom de fichier d'affichage assaini (jamais utilisé comme chemin)
    const displayName = path.basename(String(file.name || 'fichier')).slice(0, 255)
    let ext = path.extname(displayName).slice(0, 12)

    const dir = await ensureUploadDir()
    const rawBuffer = Buffer.from(await file.arrayBuffer())

    // Compression image (JPEG/PNG/WebP). Sans effet pour les autres types.
    const compressed = await compressImageIfPossible(rawBuffer, file.type)
    const finalBuffer = compressed.buffer
    const finalMime = compressed.mimeType
    const finalSize = compressed.size

    // Si on a converti en JPEG (cas PNG opaque par ex.), on force l'extension .jpg
    if (compressed.compressed && finalMime === 'image/jpeg' && ext.toLowerCase() !== '.jpg' && ext.toLowerCase() !== '.jpeg') {
      ext = '.jpg'
    }

    const storedName = `${randomUUID()}${ext}`
    await fs.writeFile(path.join(dir, storedName), finalBuffer)

    const attachment = await prisma.attachment.create({
      data: {
        fileName: displayName,
        storedName,
        mimeType: finalMime,
        size: finalSize,
        folderId: typeof folderId === 'string' && folderId ? folderId : null,
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
    logger.error('Erreur upload', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
