import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { canAccessAttachment, getRequestUser, resolveStoredPath } from '@/lib/communication'
import { COLLAB_DOC_MIME } from '../route'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

const MAX_HTML_SIZE = 5 * 1024 * 1024 // 5 Mo d'export HTML

/**
 * PUT /api/communication/docs/[id]  { html }
 * Enregistre l'export HTML courant du document (pour le téléchargement).
 * Le contenu collaboratif "vivant" reste dans l'état Yjs ; ceci est un instantané.
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
    if (!attachment) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    }

    // Autorisé : document collaboratif (export HTML) OU fichier texte (texte brut).
    const isCollabDoc = attachment.mimeType === COLLAB_DOC_MIME
    const isTextFile = attachment.mimeType === 'text/plain'
    if (!isCollabDoc && !isTextFile) {
      return NextResponse.json({ error: 'Type de document non éditable' }, { status: 400 })
    }

    const body = await request.json()
    // Pour un doc collaboratif on enregistre le HTML, pour un .txt le texte brut.
    const content = isTextFile
      ? (typeof body?.text === 'string' ? body.text : '')
      : (typeof body?.html === 'string' ? body.html : '')

    if (content.length > MAX_HTML_SIZE) {
      return NextResponse.json({ error: 'Document trop volumineux' }, { status: 400 })
    }

    const filePath = resolveStoredPath(attachment.storedName)
    if (!filePath) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

    const buffer = Buffer.from(content, 'utf-8')
    await fs.writeFile(filePath, buffer)
    await prisma.attachment.update({ where: { id }, data: { size: buffer.length } })

    return NextResponse.json({ data: { size: buffer.length }, error: null })
  } catch (error) {
    logger.error('Erreur sauvegarde export document', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/communication/docs/[id]  { name }
 * Renomme un document collaboratif (titre éditable dans l'éditeur).
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
    if (!attachment || attachment.mimeType !== COLLAB_DOC_MIME) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const name = (typeof body?.name === 'string' ? body.name : '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 200)
    if (!name) {
      return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
    }

    await prisma.attachment.update({ where: { id }, data: { fileName: name } })
    return NextResponse.json({ data: { fileName: name }, error: null })
  } catch (error) {
    logger.error('Erreur renommage document', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
