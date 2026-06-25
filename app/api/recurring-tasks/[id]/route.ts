import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyManagerOrAdmin } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyManagerOrAdmin(request)
  if (!auth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const { id } = await params
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
      isActive,
    } = body

    const task = await prisma.recurringTask.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(recurrenceType !== undefined && { recurrenceType }),
        ...(recurrenceInterval !== undefined && { recurrenceInterval: Number(recurrenceInterval) }),
        ...(startDate !== undefined && { startDate }),
        ...(excludeWeekends !== undefined && { excludeWeekends: Boolean(excludeWeekends) }),
        ...(assignedRoleIds !== undefined && { assignedRoleIds: Array.isArray(assignedRoleIds) ? assignedRoleIds : [] }),
        ...(assignedUserEmails !== undefined && { assignedUserEmails: Array.isArray(assignedUserEmails) ? assignedUserEmails : [] }),
        ...(gymId !== undefined && { gymId: gymId || null }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ data: task })
  } catch (error) {
    logger.error("Erreur mise à jour tâche récurrente", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyManagerOrAdmin(request)
  if (!auth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const { id } = await params
    await prisma.recurringTask.delete({ where: { id } })
    return NextResponse.json({ message: "Tâche supprimée" })
  } catch (error) {
    logger.error("Erreur suppression tâche récurrente", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
