import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth-middleware"

type ScheduledEventWithValidations = {
  id: string
  assignedEmployeeEmail: string | null
  assignedRoleId: string | null
  requiresValidation: boolean
  validations: Array<{
    userEmail: string
    validated: boolean
  }>
}

async function isEventValidated(event: ScheduledEventWithValidations): Promise<boolean> {
  if (!event.requiresValidation) {
    return true
  }

  const validatedEmails = event.validations.filter((v) => v.validated).map((v) => v.userEmail)
  if (validatedEmails.length === 0) {
    return false
  }

  const hasEmployeeAssignment = Boolean(event.assignedEmployeeEmail)
  const hasRoleAssignment = Boolean(event.assignedRoleId)

  if (!hasEmployeeAssignment && !hasRoleAssignment) {
    return validatedEmails.length > 0
  }

  let employeeValidated = false
  let roleValidated = false

  if (event.assignedEmployeeEmail) {
    employeeValidated = validatedEmails.includes(event.assignedEmployeeEmail)
  }

  if (event.assignedRoleId) {
    const roleUsers = await prisma.user.findMany({
      where: {
        active: true,
        roleId: event.assignedRoleId,
      },
      select: {
        email: true,
      },
    })

    const roleEmails = new Set(roleUsers.map((u) => u.email))
    roleValidated = validatedEmails.some((email) => roleEmails.has(email))
  }

  return employeeValidated || roleValidated
}

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const userEmail = searchParams.get("user_email")

    const where: any = {}
    if (eventId) {
      where.eventId = eventId
    }
    if (userEmail) {
      where.userEmail = userEmail
    }

    const validations = await prisma.scheduledEventValidation.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    const data = validations.map((item) => ({
      id: item.id,
      event_id: item.eventId,
      user_email: item.userEmail,
      validated: item.validated,
      validated_at: item.validatedAt?.toISOString() || null,
      created_at: item.createdAt.toISOString(),
    }))

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error("Erreur récupération validations:", error)
    return NextResponse.json({ error: "Impossible de récupérer les validations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { eventId, userEmail } = body

    if (!eventId || !userEmail) {
      return NextResponse.json({ error: "eventId et userEmail sont obligatoires" }, { status: 400 })
    }

    const validation = await prisma.scheduledEventValidation.upsert({
      where: {
        eventId_userEmail: {
          eventId,
          userEmail,
        },
      },
      update: {
        validated: true,
        validatedAt: new Date(),
      },
      create: {
        eventId,
        userEmail,
        validated: true,
        validatedAt: new Date(),
      },
    })

    const event = await prisma.scheduledEvent.findUnique({
      where: { id: eventId },
      include: {
        validations: {
          select: {
            userEmail: true,
            validated: true,
          },
        },
      },
    })

    if (event) {
      const validated = await isEventValidated(event)
      if (validated) {
        await prisma.scheduledEvent.update({
          where: { id: eventId },
          data: {
            status: "validated",
          },
        })
      }
    }

    return NextResponse.json(
      {
        data: {
          id: validation.id,
          event_id: validation.eventId,
          user_email: validation.userEmail,
          validated: validation.validated,
          validated_at: validation.validatedAt?.toISOString() || null,
          created_at: validation.createdAt.toISOString(),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Erreur validation événement:", error)
    return NextResponse.json({ error: "Impossible de valider l'événement" }, { status: 500 })
  }
}
