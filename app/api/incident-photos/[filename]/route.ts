import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { verifyAuth } from '@/lib/auth-middleware'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

const INCIDENTS_DIR = () => {
  const base = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  return path.join(base, 'incidents')
}

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/**
 * GET /api/incident-photos/[filename] — Sert une photo d'incident.
 * Auth requise.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return new NextResponse(null, { status: 401 })
  }

  try {
    const { filename } = await params
    const safeName = path.basename(filename)
    if (!safeName || safeName.includes('..')) {
      return new NextResponse(null, { status: 400 })
    }

    const filePath = path.join(INCIDENTS_DIR(), safeName)
    const buffer = await fs.readFile(filePath).catch(() => null)
    if (!buffer) return new NextResponse(null, { status: 404 })

    const ext = path.extname(safeName).toLowerCase()
    const mime = MIME_MAP[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (error) {
    logger.error('Erreur GET incident photo', error)
    return new NextResponse(null, { status: 500 })
  }
}
