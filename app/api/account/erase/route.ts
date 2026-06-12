import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import logger from '@/lib/logger'

/**
 * Droit à l'effacement (RGPD Art. 17).
 *
 * Plutôt qu'une suppression brutale (qui briserait l'intégrité référentielle et
 * peut entrer en conflit avec les obligations légales de conservation, ex. paie),
 * on procède à une ANONYMISATION : toutes les données personnelles identifiantes
 * (email, nom, pseudo, mot de passe, photo) sont remplacées par des valeurs
 * neutres, et le compte est désactivé. Les enregistrements dénormalisés
 * (email/nom recopiés dans d'autres tables) sont également anonymisés.
 *
 * POST /api/account/erase  { userId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let userId: string
  try {
    const body = await request.json()
    userId = body.userId
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })

    if (!target) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    // Un superadmin ne peut être anonymisé que par un autre superadmin.
    if (target.role === 'superadmin' && auth.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Seul un superadmin peut effacer un compte superadmin' },
        { status: 403 },
      )
    }

    const oldEmail = target.email
    const anonEmail = `anonymise-${userId}@supprime.local`
    const anonName = 'Utilisateur supprimé'

    await prisma.$transaction(async (tx) => {
      // 1) Données dénormalisées (email/nom recopiés) → anonymisées
      await tx.workSchedule.updateMany({
        where: { userId },
        data: { employeeEmail: anonEmail, employeeName: anonName },
      })
      await tx.timeEntry.updateMany({
        where: { userId },
        data: { employeeEmail: anonEmail, employeeName: anonName },
      })
      await tx.cashRegisterEntry.updateMany({
        where: { userEmail: oldEmail },
        data: { userEmail: anonEmail, userName: anonName },
      })
      await tx.scheduledEventValidation.updateMany({
        where: { userEmail: oldEmail },
        data: { userEmail: anonEmail },
      })
      await tx.calendarEvent.updateMany({
        where: { createdByEmail: oldEmail },
        data: { createdByEmail: anonEmail, createdByName: anonName },
      })

      // 2) Messagerie : contenu effacé (soft delete) pour retirer les données perso
      await tx.message.updateMany({
        where: { senderId: userId, deletedAt: null },
        data: { content: '[message supprimé]', deletedAt: new Date() },
      })

      // 3) Jetons de réinitialisation supprimés
      await tx.passwordResetToken.deleteMany({ where: { userId } })

      // 4) Compte utilisateur anonymisé et désactivé
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonEmail,
          username: null,
          password: null,
          name: anonName,
          profilePhoto: null,
          active: false,
          remoteWorkEnabled: false,
        },
      })
    })

    logger.info(`Anonymisation RGPD du compte ${userId} effectuée par ${auth.userId}`)

    return NextResponse.json({
      success: true,
      message: 'Les données personnelles de cet utilisateur ont été anonymisées et le compte désactivé.',
    })
  } catch (error) {
    logger.error('Erreur anonymisation RGPD', error)
    return NextResponse.json({ error: 'Erreur lors de l’anonymisation' }, { status: 500 })
  }
}
