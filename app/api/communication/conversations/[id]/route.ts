import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { getMembership, isAppAdmin } from '@/lib/communication'
import logger from '@/lib/logger'

/** PATCH : renommer un groupe { name } (admin du groupe ou admin app). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const { id } = await params
    const conv = await prisma.conversation.findUnique({ where: { id } })
    if (!conv || conv.type !== 'group') {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }
    const membership = await getMembership(id, auth.userId)
    if (!membership || (!isAppAdmin(auth.role) && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Nom invalide (1-100 caractères)' }, { status: 400 })
    }

    await prisma.conversation.update({ where: { id }, data: { name } })
    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Erreur PATCH conversation', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
