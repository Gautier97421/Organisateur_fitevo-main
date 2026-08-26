import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuth, verifyManagerOrAdmin } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

function isDueToday(startDate: string, recurrenceType: string, recurrenceInterval: number, excludeWeekends = false): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // If excludeWeekends and today is Saturday(6) or Sunday(0), never due
  if (excludeWeekends && (today.getDay() === 0 || today.getDay() === 6)) return false

  const start = new Date(startDate + "T00:00:00")
  start.setHours(0, 0, 0, 0)

  if (today < start) return false

  // Tâche ponctuelle : une seule échéance, mais elle reste due tant qu'elle n'est pas faite —
  // sinon une tâche oubliée disparaîtrait de la to-do dès le lendemain. Le retrait après
  // complétion est géré plus bas, à partir de l'historique.
  if (recurrenceType === "once") return true

  if (recurrenceType === "daily") {
    if (excludeWeekends) {
      // Count only working days between start and today
      let workingDays = 0
      const cursor = new Date(start)
      while (cursor < today) {
        cursor.setDate(cursor.getDate() + 1)
        if (cursor.getDay() !== 0 && cursor.getDay() !== 6) workingDays++
      }
      return workingDays % recurrenceInterval === 0
    }
    const diffDays = Math.round((today.getTime() - start.getTime()) / 86400000)
    return diffDays % recurrenceInterval === 0
  }

  if (recurrenceType === "weekly") {
    const diffDays = Math.round((today.getTime() - start.getTime()) / 86400000)
    return diffDays % (recurrenceInterval * 7) === 0
  }

  if (recurrenceType === "monthly") {
    const yearDiff = today.getFullYear() - start.getFullYear()
    const monthDiff = yearDiff * 12 + (today.getMonth() - start.getMonth())
    if (monthDiff < 0 || monthDiff % recurrenceInterval !== 0) return false
    return today.getDate() === start.getDate()
  }

  return false
}

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const gymId = searchParams.get("gym_id")
    const userEmail = searchParams.get("user_email")
    const userRoleId = searchParams.get("role_id")
    const dueTodayOnly = searchParams.get("due_today") === "true"
    const adminMode = searchParams.get("admin") === "true"
    // "once" = tâches ponctuelles, "recurring" = tout le reste. Les deux écrans d'administration
    // se partagent la même table mais ne doivent pas afficher les tâches l'un de l'autre.
    const recurrenceFilter = searchParams.get("recurrence")

    const where: any = { isActive: true }
    if (recurrenceFilter === "once") {
      where.recurrenceType = "once"
    } else if (recurrenceFilter === "recurring") {
      where.recurrenceType = { not: "once" }
    }
    if (gymId) {
      // Include tasks with this gymId OR global tasks (gymId null = all gyms)
      where.OR = [{ gymId }, { gymId: null }]
    }

    const tasks = await prisma.recurringTask.findMany({
      where,
      include: { completions: true },
      orderBy: { createdAt: "desc" },
    })

    if (adminMode) {
      return NextResponse.json({ data: tasks })
    }

    const today = new Date().toISOString().split("T")[0]

    let filtered = tasks

    // Filter by role or user if specified
    if (userEmail || userRoleId) {
      filtered = tasks.filter((t) => {
        const roleIds = Array.isArray(t.assignedRoleIds) ? t.assignedRoleIds as string[] : []
        const userEmails = Array.isArray(t.assignedUserEmails) ? t.assignedUserEmails as string[] : []
        const isGlobal = roleIds.length === 0 && userEmails.length === 0
        const matchesRole = userRoleId ? roleIds.includes(userRoleId) : false
        const matchesEmail = userEmail ? userEmails.includes(userEmail) : false
        return isGlobal || matchesRole || matchesEmail
      })
    }

    if (dueTodayOnly) {
      filtered = filtered.filter((t) => isDueToday(t.startDate, t.recurrenceType, t.recurrenceInterval, t.excludeWeekends))
    }

    // Attach completion status for today
    const result = []
    for (const t of filtered) {
      const mine = t.completions.filter((c) => (userEmail ? c.completedBy === userEmail : true))
      const completedToday = mine.some((c) => c.dueDate === today)

      // Une tâche ponctuelle faite ne revient jamais : elle reste visible le jour même (pour
      // pouvoir être décochée en cas d'erreur), puis disparaît.
      if (t.recurrenceType === "once" && !completedToday && mine.length > 0) continue

      result.push({ ...t, completedToday, completions: undefined })
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    logger.error("Erreur récupération tâches récurrentes", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyManagerOrAdmin(request)
  if (!auth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const body = await request.json()
    const {
      title,
      description,
      recurrenceType,
      recurrenceInterval,
      startDate,
      excludeWeekends,
      assignedRoleIds,
      assignedUserEmails,
      gymId,
    } = body

    if (!title || !recurrenceType || !startDate) {
      return NextResponse.json(
        { error: "title, recurrenceType et startDate sont obligatoires" },
        { status: 400 }
      )
    }

    // Une tâche ponctuelle n'a ni intervalle ni exclusion de weekend : une seule échéance.
    const isOnce = recurrenceType === "once"

    const task = await prisma.recurringTask.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        recurrenceType,
        recurrenceInterval: isOnce ? 1 : Number(recurrenceInterval) || 1,
        startDate,
        excludeWeekends: isOnce ? false : Boolean(excludeWeekends),
        assignedRoleIds: Array.isArray(assignedRoleIds) ? assignedRoleIds : [],
        assignedUserEmails: Array.isArray(assignedUserEmails) ? assignedUserEmails : [],
        gymId: gymId || null,
        createdBy: auth.userId,
      },
    })

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    logger.error("Erreur création tâche récurrente", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
