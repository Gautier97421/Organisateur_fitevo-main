import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { canAccessAttachment, getRequestUser, resolveStoredPath } from '@/lib/communication'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

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
