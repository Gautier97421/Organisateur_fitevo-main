import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-middleware"
import { sendEventReminderEmail, sendValidationOverdueEmail } from "@/lib/email"
import logger from "@/lib/logger"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ success: false, message: "Authentification requise" }, { status: 401 })
  }

  try {
    const now = new Date()

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

    for (const reminder of pendingReminders) {
      try {
        // Déterminer les destinataires selon recipientType
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
        const recipientEmails = recipients.map((u: { email: string }) => u.email)

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

    logger.info(`Rappels traités: ${processed}/${pendingReminders.length}`)

    // ── Vérification des événements non validés dans les temps ──
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const overdueEvents = await prisma.scheduledEvent.findMany({
      where: {
        requiresValidation: true,
        eventDate: { lt: startOfToday },
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
