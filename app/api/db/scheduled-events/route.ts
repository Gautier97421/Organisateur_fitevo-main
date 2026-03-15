import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth-middleware"

type ScheduledEventWithValidations = {
  id: string
  title: string
  description: string | null
  eventDate: Date
  startTime: string | null
  endTime: string | null
  assignedEmployeeEmail: string | null
  assignedRoleId: string | null
  requiresValidation: boolean
  status: string
  createdByEmail: string
  createdAt: Date
  updatedAt: Date
  validations: Array<{
    userEmail: string
    validated: boolean
    validatedAt: Date | null
  }>
}

function toDayStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0))
}

function normalizeDateInput(rawDate: string): Date {
  if (rawDate.includes("T")) {
    return new Date(rawDate)
  }
  return new Date(`${rawDate}T00:00:00.000Z`)
}

function buildEndTime(startTime: string | null, durationMinutes: number): string | null {
  if (!startTime) return null
  const [hoursRaw, minutesRaw] = startTime.split(":")
  const hours = Number.parseInt(hoursRaw, 10)
  const minutes = Number.parseInt(minutesRaw, 10)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }

  const total = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor((total % (24 * 60)) / 60)
  const endMinutes = total % 60

  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`
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
    const users = await prisma.user.findMany({
      where: {
        active: true,
        roleId: event.assignedRoleId,
      },
      select: {
        email: true,
      },
    })

    const roleEmails = new Set(users.map((u) => u.email))
    roleValidated = validatedEmails.some((email) => roleEmails.has(email))
  }

  return employeeValidated || roleValidated
}

async function moveOverdueUnvalidatedEvents() {
  const now = new Date()
  const todayStart = toDayStart(now)
  const tomorrow = new Date(todayStart)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  const overdueEvents = await prisma.scheduledEvent.findMany({
    where: {
      requiresValidation: true,
      eventDate: {
        lt: todayStart,
      },
    },
    include: {
      validations: {
        select: {
          userEmail: true,
          validated: true,
          validatedAt: true,
        },
      },
    },
  })

  for (const event of overdueEvents) {
    const validated = await isEventValidated(event)
    if (!validated) {
      await prisma.scheduledEvent.update({
        where: { id: event.id },
        data: {
          eventDate: tomorrow,
          status: "moved",
        },
      })
    }
  }
}

function mapToClient(event: ScheduledEventWithValidations, currentUserEmail?: string | null) {
  const validatedByCurrentUser = currentUserEmail
    ? event.validations.some((v) => v.validated && v.userEmail === currentUserEmail)
    : false

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    event_date: event.eventDate.toISOString(),
    start_time: event.startTime,
    end_time: event.endTime,
    assigned_employee_email: event.assignedEmployeeEmail,
    assigned_role_id: event.assignedRoleId,
    requires_validation: event.requiresValidation,
    status: event.status,
    created_by_email: event.createdByEmail,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt.toISOString(),
    validated_users: event.validations.filter((v) => v.validated).map((v) => v.userEmail),
    is_validated_by_current_user: validatedByCurrentUser,
  }
}

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }

  try {
    await moveOverdueUnvalidatedEvents()

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("start_date")
    const endDateParam = searchParams.get("end_date")
    const userEmail = searchParams.get("user_email")
    const roleId = searchParams.get("role_id")
    const includeAll = searchParams.get("include_all") === "true"

    const where: any = {}

    if (startDateParam || endDateParam) {
      where.eventDate = {}
      if (startDateParam) {
        where.eventDate.gte = normalizeDateInput(startDateParam)
      }
      if (endDateParam) {
        const endDate = normalizeDateInput(endDateParam)
        endDate.setUTCHours(23, 59, 59, 999)
        where.eventDate.lte = endDate
      }
    }

    if (!includeAll) {
      const visibilityFilters: any[] = [
        { assignedEmployeeEmail: null, assignedRoleId: null },
      ]

      if (userEmail) {
        visibilityFilters.push({ assignedEmployeeEmail: userEmail })
      }

      if (roleId) {
        visibilityFilters.push({ assignedRoleId: roleId })
      }

      where.OR = visibilityFilters
    }

    const events = await prisma.scheduledEvent.findMany({
      where,
      orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
      include: {
        validations: {
          select: {
            userEmail: true,
            validated: true,
            validatedAt: true,
          },
        },
      },
    })

    const data = events.map((event) => mapToClient(event, userEmail))
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error("Erreur récupération événements planifiés:", error)
    return NextResponse.json({ error: "Impossible de récupérer les événements planifiés" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      title,
      description,
      eventDate,
      startTime,
      endTime,
      durationMinutes,
      assignedEmployeeEmail,
      assignedRoleId,
      requiresValidation,
      createdByEmail,
    } = body

    if (!title || !eventDate || !createdByEmail) {
      return NextResponse.json(
        { error: "title, eventDate et createdByEmail sont obligatoires" },
        { status: 400 },
      )
    }

    const normalizedDate = normalizeDateInput(eventDate)
    const finalEndTime = endTime || buildEndTime(startTime || null, durationMinutes || 60)

    const created = await prisma.scheduledEvent.create({
      data: {
        title,
        description: description || null,
        eventDate: normalizedDate,
        startTime: startTime || null,
        endTime: finalEndTime,
        assignedEmployeeEmail: assignedEmployeeEmail || null,
        assignedRoleId: assignedRoleId || null,
        requiresValidation: Boolean(requiresValidation),
        status: Boolean(requiresValidation) ? "pending" : "validated",
        createdByEmail,
      },
      include: {
        validations: {
          select: {
            userEmail: true,
            validated: true,
            validatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({ data: mapToClient(created, null) }, { status: 201 })
  } catch (error) {
    console.error("Erreur création événement planifié:", error)
    return NextResponse.json({ error: "Impossible de créer l'événement planifié" }, { status: 500 })
  }
}
