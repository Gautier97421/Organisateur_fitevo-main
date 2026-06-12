import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import logger from '@/lib/logger'

/**
 * Export des données personnelles d'un utilisateur (RGPD Art. 20 - portabilité).
 * Réservé aux administrateurs : permet de fournir à la personne concernée
 * l'ensemble de ses données dans un format structuré et lisible (JSON).
 *
 * GET /api/account/export?userId=xxx
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, name: true, role: true,
        active: true, profilePhoto: true, createdAt: true, updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const [workSchedules, timeEntries, calendarEvents, cashEntries, validations, messages] =
      await Promise.all([
        prisma.workSchedule.findMany({ where: { userId } }),
        prisma.timeEntry.findMany({ where: { userId } }),
        prisma.calendarEvent.findMany({ where: { OR: [{ userId }, { createdByEmail: user.email }] } }),
        prisma.cashRegisterEntry.findMany({ where: { userEmail: user.email } }),
        prisma.scheduledEventValidation.findMany({ where: { userEmail: user.email } }),
        prisma.message.findMany({
          where: { senderId: userId },
          select: { id: true, conversationId: true, content: true, createdAt: true, editedAt: true, deletedAt: true },
        }),
      ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: auth.userId,
      subject: user,
      workSchedules,
      timeEntries,
      calendarEvents,
      cashRegisterEntries: cashEntries,
      scheduledEventValidations: validations,
      messages,
    }

    logger.info(`Export RGPD des données de l’utilisateur ${userId} demandé par ${auth.userId}`)

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="donnees-${userId}.json"`,
      },
    })
  } catch (error) {
    logger.error('Erreur export RGPD', error)
    return NextResponse.json({ error: 'Erreur lors de l’export' }, { status: 500 })
  }
}
