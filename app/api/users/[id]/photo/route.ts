import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { isAppAdmin } from '@/lib/communication'
import logger from '@/lib/logger'

export const runtime = 'nodejs'

const PROFILES_DIR = () => {
  const base = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  return path.join(base, 'profiles')
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE = 5 * 1024 * 1024 // 5 Mo

async function ensureProfilesDir(): Promise<string> {
  const dir = PROFILES_DIR()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/**
 * POST /api/users/[id]/photo — Upload / remplace la photo de profil.
 * Réservé à l'admin ou à l'utilisateur lui-même.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const { id } = await params
  if (!isAppAdmin(auth.role) && auth.userId !== id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const form = await request.formData()
    const file = form.get('photo')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Format non autorisé (JPEG, PNG, WebP, GIF)' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : file.type === 'image/gif' ? '.gif' : '.jpg'
    const dir = await ensureProfilesDir()

    // Supprimer l'ancienne photo si elle existe
    const existing = await prisma.user.findUnique({ where: { id }, select: { profilePhoto: true } })
    if (existing?.profilePhoto) {
      const oldFile = path.join(dir, path.basename(existing.profilePhoto))
      await fs.unlink(oldFile).catch(() => {})
    }

    const filename = `${id}${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(dir, filename), buffer)

    const photoUrl = `/api/users/${id}/photo`
    await prisma.user.update({ where: { id }, data: { profilePhoto: filename } })

    return NextResponse.json({ data: { photoUrl }, error: null })
  } catch (error) {
    logger.error('Erreur upload photo profil', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * GET /api/users/[id]/photo — Sert la photo de profil.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await prisma.user.findUnique({ where: { id }, select: { profilePhoto: true } })
    if (!user?.profilePhoto) {
      return new NextResponse(null, { status: 404 })
    }

    const dir = PROFILES_DIR()
    const filePath = path.join(dir, path.basename(user.profilePhoto))
    const buffer = await fs.readFile(filePath).catch(() => null)
    if (!buffer) return new NextResponse(null, { status: 404 })

    const ext = path.extname(user.profilePhoto).toLowerCase()
    const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }
    const mime = mimeMap[ext] || 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    logger.error('Erreur GET photo profil', error)
    return new NextResponse(null, { status: 500 })
  }
}

/**
 * DELETE /api/users/[id]/photo — Supprime la photo de profil.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(_request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const { id } = await params
  if (!isAppAdmin(auth.role) && auth.userId !== id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { profilePhoto: true } })
    if (user?.profilePhoto) {
      const dir = PROFILES_DIR()
      await fs.unlink(path.join(dir, path.basename(user.profilePhoto))).catch(() => {})
    }
    await prisma.user.update({ where: { id }, data: { profilePhoto: null } })
    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur DELETE photo profil', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
