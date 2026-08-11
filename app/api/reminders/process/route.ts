import { type NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { verifyAuth, verifyManagerOrAdmin } from "@/lib/auth-middleware"
import { sendEventReminderEmail, sendValidationOverdueEmail } from "@/lib/email"
import logger from "@/lib/logger"
import { prisma } from "@/lib/prisma"

/**
 * Le planificateur interne (server.js) s'authentifie avec CRON_SECRET : les rappels
 * doivent partir même si aucun admin n'a l'application ouverte dans son navigateur.
 * Comparaison à temps constant pour ne rien divulguer du secret.
 */
function isInternalScheduler(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get("x-cron-secret")
  if (!secret || !provided) return false

  const a = Buffer.from(secret)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Au-delà de ce retard, un rappel n'est plus envoyé mais simplement classé.
 * Protège du cas où une file de rappels s'est accumulée (aucun planificateur ne
 * tournait avant, seule la page admin ouverte déclenchait le traitement) : sans
 * ce garde-fou, le premier tick enverrait d'un coup des rappels pour des
 * événements passés depuis des semaines.
 */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * Même garde-fou pour les alertes de validation en retard, mais exprimé en jours :
 * `event_date` est une date à minuit, un seuil en heures l'exclurait systématiquement.
 * On remonte donc jusqu'à une semaine de retard, pas au-delà.
 */
const OVERDUE_LOOKBACK_DAYS = 7

// Tâche de maintenance (envoi en masse de rappels) — pas une action qu'un employé
// quelconque doit pouvoir déclencher à volonté.
export async function POST(request: NextRequest) {
  if (!isInternalScheduler(request)) {
    const auth = await verifyManagerOrAdmin(request)
    if (!auth) {
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 403 })
    }
  }

  try {
    const now = new Date()
    const staleBefore = new Date(now.getTime() - STALE_AFTER_MS)

    // Chercher tous les rappels dont la date est passée et qui n'ont pas encore été envoyés
    const pendingReminders = await (prisma as any).eventReminder.findMany({
      where: {
        reminderDate: { lte: now },
        sentAt: null,
      },
      include: {
        event: {
          select: {
            title: true,
            eventDate: true,
            eventTime: true,
            location: true,
          },
        },
      },
    })

    let processed = 0
    let skippedStale = 0

    for (const reminder of pendingReminders) {
      try {
        // Un rappel très en retard n'a plus d'utilité : l'événement est passé depuis
        // longtemps. On le classe sans l'envoyer, sinon toute une file accumulée
        // (aucun planificateur ne tournait avant) partirait d'un coup.
        if (reminder.reminderDate < staleBefore) {
          await (prisma as any).eventReminder.update({
            where: { id: reminder.id },
            data: { sentAt: now },
          })
          skippedStale++
          continue
        }

        // Déterminer les destinataires selon recipientType
        let recipientEmails: string[]

        if (reminder.recipientType === "creator") {
          // « Moi uniquement » : seul l'auteur du rappel est notifié. On repasse par
          // la base plutôt que d'utiliser created_by tel quel, pour ne pas écrire à
          // un compte désactivé ou supprimé depuis la création du rappel.
          const creator = await prisma.user.findFirst({
            where: { email: reminder.createdBy, active: true },
            select: { email: true },
          })
          recipientEmails = creator ? [creator.email] : []
        } else {
          let whereRole: object = {}
          if (reminder.recipientType === "admins") {
            whereRole = { role: { in: ["admin", "superadmin"] } }
          } else if (reminder.recipientType === "employees") {
            whereRole = { role: { notIn: ["admin", "superadmin"] } }
          }
          // "all" = pas de filtre de rôle

          const recipients = await prisma.user.findMany({
            where: { active: true, ...whereRole },
            select: { email: true },
          })
          recipientEmails = recipients.map((u: { email: string }) => u.email)
        }

        await sendEventReminderEmail({
          eventTitle: reminder.event.title,
          eventDate: reminder.event.eventDate.toISOString(),
          eventTime: reminder.event.eventTime ?? undefined,
          eventLocation: reminder.event.location || undefined,
          customMessage: reminder.customMessage ?? undefined,
          recipientEmails,
        })

        // Marquer le rappel comme envoyé
        await (prisma as any).eventReminder.update({
          where: { id: reminder.id },
          data: { sentAt: now },
        })

        processed++
      } catch (err) {
        logger.error(`Erreur envoi rappel ${reminder.id}`, err)
        // On continue avec les autres rappels même si l'un échoue
      }
    }

    if (pendingReminders.length > 0) {
      logger.info(
        `Rappels traités: ${processed}/${pendingReminders.length}` +
          (skippedStale > 0 ? ` (${skippedStale} trop anciens, classés sans envoi)` : "")
      )
    }

    // ── Vérification des événements non validés dans les temps ──
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const overdueSince = new Date(startOfToday)
    overdueSince.setDate(overdueSince.getDate() - OVERDUE_LOOKBACK_DAYS)

    const overdueEvents = await prisma.scheduledEvent.findMany({
      where: {
        requiresValidation: true,
        // Même garde-fou que pour les rappels : on ne notifie que le retard récent,
        // pas tout l'historique resté non traité faute de planificateur.
        eventDate: { lt: startOfToday, gte: overdueSince },
        validationNotifiedAt: null,
        status: { not: "moved" },
      },
      include: {
        validations: { where: { validated: true } },
      },
    })

    let overdueProcessed = 0
    for (const event of overdueEvents) {
      try {
        // Déterminer si l'événement a été validé par l'ensemble des assignés
        // S'il y a au moins une validation confirmée, on ne notifie pas
        if (event.validations.length > 0) {
          // Marquer quand même pour ne plus retraiter
          await prisma.scheduledEvent.update({
            where: { id: event.id },
            data: { validationNotifiedAt: now },
          })
          continue
        }

        // Trouver les destinataires selon l'assignation
        let recipientEmails: string[] = []
        if (event.assignedEmployeeEmail) {
          recipientEmails = [event.assignedEmployeeEmail]
        } else if (event.assignedRoleId) {
          const roleUsers = await prisma.user.findMany({
            where: { roleId: event.assignedRoleId, active: true },
            select: { email: true },
          })
          recipientEmails = roleUsers.map((u: { email: string }) => u.email)
        } else {
          // Pas d'assignation précise → notifier tous les employés
          const allEmployees = await prisma.user.findMany({
            where: { role: { notIn: ["admin", "superadmin"] }, active: true },
            select: { email: true },
          })
          recipientEmails = allEmployees.map((u: { email: string }) => u.email)
        }

        await sendValidationOverdueEmail({
          eventTitle: event.title,
          eventDate: event.eventDate.toISOString(),
          recipientEmails,
        })

        await prisma.scheduledEvent.update({
          where: { id: event.id },
          data: {
            validationNotifiedAt: now,
            status: "overdue_notified",
          },
        })

        overdueProcessed++
      } catch (err) {
        logger.error(`Erreur notification retard événement ${event.id}`, err)
      }
    }

    if (overdueEvents.length > 0) {
      logger.info(`Événements non validés notifiés: ${overdueProcessed}/${overdueEvents.length}`)
    }

    return NextResponse.json({ success: true, processed, overdueNotified: overdueProcessed })
  } catch (error) {
    logger.error("Erreur traitement rappels", error)
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 })
  }
}

// GET : retourne le nombre de rappels en attente (utile pour l'UI)
export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ success: false, message: "Authentification requise" }, { status: 401 })
  }

  try {
    const now = new Date()
    const count = await (prisma as any).eventReminder.count({
      where: {
        reminderDate: { lte: now },
        sentAt: null,
      },
    })
    return NextResponse.json({ success: true, pending: count })
  } catch (error) {
    logger.error("Erreur comptage rappels", error)
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 })
  }
}
