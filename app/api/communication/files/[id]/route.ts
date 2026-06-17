import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'node:fs'
import { stat, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { canAccessAttachment, getRequestUser, resolveStoredPath, MAX_UPLOAD_SIZE, isAppAdmin } from '@/lib/communication'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

// Types éditables en place (remplacement du contenu) : tableurs + texte ODF.
const EDITABLE_IN_PLACE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'text/csv', // .csv
  'application/vnd.oasis.opendocument.text', // .odt
])

/**
 * GET /api/communication/files/[id]
 *
 * Sert une pièce jointe après vérification d'accès (dossier visible OU message
 * d'une conversation dont l'utilisateur est membre). Stream depuis le disque.
 *
 * `?disposition=inline` affiche le fichier dans le navigateur (prévisualisation)
 * au lieu de forcer le téléchargement.
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
    const disposition = request.nextUrl.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'

    if (!(await canAccessAttachment(id, reqUser))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })

    const filePath = resolveStoredPath(attachment.storedName)
    if (!filePath) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })

    let fileSize = attachment.size
    try {
      const info = await stat(filePath)
      fileSize = info.size
    } catch {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
    }

    const nodeStream = createReadStream(filePath)
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream

    // Nom encodé pour l'en-tête (RFC 5987)
    const encoded = encodeURIComponent(attachment.fileName)
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Length': String(fileSize),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encoded}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    logger.error('Erreur download fichier', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PUT /api/communication/files/[id]  (multipart/form-data, champ "file")
 *
 * Remplace le contenu d'un tableur existant (xlsx/ods/xls/csv) après édition
 * dans l'éditeur intégré. Conserve le nom et le type ; met à jour la taille.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const reqUser = await getRequestUser(auth.userId)
    if (!reqUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 })

    const { id } = await params
    if (!(await canAccessAttachment(id, reqUser))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })

    // Seuls les tableurs et documents ODF texte sont éditables en place ici.
    if (!EDITABLE_IN_PLACE_MIMES.has(attachment.mimeType)) {
      return NextResponse.json({ error: 'Type de fichier non éditable' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'Fichier invalide ou trop volumineux' }, { status: 400 })
    }

    const filePath = resolveStoredPath(attachment.storedName)
    if (!filePath) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)
    await prisma.attachment.update({ where: { id }, data: { size: buffer.length } })

    return NextResponse.json({ data: { size: buffer.length }, error: null })
  } catch (error) {
    logger.error('Erreur sauvegarde tableur', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/communication/files/[id]
 * Renomme un fichier (champ fileName). L'extension d'origine est conservée
 * pour ne pas casser la détection du type (tableur, ODF…).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const reqUser = await getRequestUser(auth.userId)
    if (!reqUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 })

    const { id } = await params
    if (!(await canAccessAttachment(id, reqUser))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    let name = String(body?.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    // Assainir : jamais utilisé comme chemin
    name = path.basename(name).slice(0, 255)

    // Conserver l'extension d'origine si l'utilisateur l'a retirée/modifiée.
    const origExt = path.extname(attachment.fileName)
    if (origExt) {
      const typedExt = path.extname(name)
      if (typedExt.toLowerCase() !== origExt.toLowerCase()) {
        name = name.replace(/\.[^.]*$/, '') + origExt
      }
    }
    if (!name || name === origExt) name = `fichier${origExt}`

    const updated = await prisma.attachment.update({ where: { id }, data: { fileName: name } })
    return NextResponse.json({ data: { fileName: updated.fileName }, error: null })
  } catch (error) {
    logger.error('Erreur renommage fichier', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/communication/files/[id]
 * Supprime un fichier. Autorisé : l'auteur du dépôt, le créateur du dossier, ou un admin.
 * Retire l'enregistrement, le fichier disque, et l'éventuel état collaboratif (.ydoc).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const reqUser = await getRequestUser(auth.userId)
    if (!reqUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 })

    const { id } = await params
    if (!(await canAccessAttachment(id, reqUser))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const attachment = await prisma.attachment.findUnique({ where: { id }, include: { folder: true } })
    if (!attachment) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })

    const isUploader = attachment.uploadedBy === auth.userId
    const isFolderOwner = attachment.folder?.createdBy === auth.userId
    if (!isUploader && !isFolderOwner && !isAppAdmin(auth.role)) {
      return NextResponse.json({ error: 'Suppression non autorisée' }, { status: 403 })
    }

    await prisma.attachment.delete({ where: { id } })

    // Fichier physique (best-effort)
    const filePath = resolveStoredPath(attachment.storedName)
    if (filePath) await unlink(filePath).catch(() => {})

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur suppression fichier', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
