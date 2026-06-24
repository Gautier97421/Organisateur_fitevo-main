import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { verifyAuth } from '@/lib/auth-middleware'
import { compressImageIfPossible } from '@/lib/image-compression'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

const INCIDENTS_DIR = () => {
  const base = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  return path.join(base, 'incidents')
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE = 8 * 1024 * 1024 // 8 Mo

async function ensureDir(): Promise<string> {
  const dir = INCIDENTS_DIR()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/**
 * POST /api/incident-photos — Upload d'une photo liée à un champ personnalisé.
 * Renvoie { filename } à stocker dans `custom_values` de l'entrée caisse.
 */
export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const file = form.get('photo')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 8 Mo)' }, { status: 400 })
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Format non autorisé (JPEG, PNG, WebP, GIF)' }, { status: 400 })
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const compressed = await compressImageIfPossible(rawBuffer, file.type)
    const mime = compressed.compressed ? compressed.mimeType : file.type
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    }
    const ext = extMap[mime] || '.jpg'

    const dir = await ensureDir()
    const filename = `${randomUUID()}${ext}`
    await fs.writeFile(path.join(dir, filename), compressed.buffer)

    return NextResponse.json({ data: { filename } })
  } catch (error) {
    logger.error('Erreur upload incident photo', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
