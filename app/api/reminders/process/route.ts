import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-middleware"
import { sendEventReminderEmail } from "@/lib/email"
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

    if (pendingReminders.length === 0) {
      return NextResponse.json({ success: true, processed: 0 })
    }

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
    return NextResponse.json({ success: true, processed })
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
