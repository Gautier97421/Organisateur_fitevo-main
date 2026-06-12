import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import logger from '@/lib/logger'

/**
 * GET /api/communication/directory
 * Annuaire léger des utilisateurs actifs pour démarrer une conversation.
 * Communication libre : tout utilisateur authentifié voit l'annuaire (sauf lui-même).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    // Les superadmins sont invisibles pour les admins/employés : ils ne peuvent
    // ni les voir dans l'annuaire ni démarrer une conversation avec eux.
    const hideSuperadmins = auth.role !== 'superadmin'

    const users = await prisma.user.findMany({
      where: {
        active: true,
        id: { not: auth.userId },
        ...(hideSuperadmins ? { role: { not: 'superadmin' } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employeeRole: { select: { id: true, name: true, color: true } },
      },
      orderBy: { name: 'asc' },
      take: 100,
    })

    return NextResponse.json({ data: users, error: null })
  } catch (error) {
    logger.error('Erreur GET directory', error)
    return NextResponse.json({ data: null, error: 'Erreur serveur' }, { status: 500 })
  }
}
