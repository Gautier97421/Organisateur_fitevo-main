import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await verifyAuth(request)
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const { completedBy, completedByName, dueDate } = body

    if (!completedBy || !dueDate) {
      return NextResponse.json({ error: "completedBy et dueDate sont obligatoires" }, { status: 400 })
    }

    const task = await prisma.recurringTask.findUnique({ where: { id } })
    if (!task) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 })

    const completion = await prisma.recurringTaskCompletion.upsert({
      where: {
        recurringTaskId_dueDate_completedBy: {
          recurringTaskId: id,
          dueDate,
          completedBy,
        },
      },
      create: {
        recurringTaskId: id,
        completedBy,
        completedByName: completedByName || null,
        dueDate,
      },
      update: {},
    })

    return NextResponse.json({ data: completion }, { status: 201 })
  } catch (error) {
    logger.error("Erreur complétion tâche récurrente", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await verifyAuth(request)
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const completedBy = searchParams.get("completed_by")
    const dueDate = searchParams.get("due_date")

    if (!completedBy || !dueDate) {
      return NextResponse.json({ error: "completed_by et due_date sont requis" }, { status: 400 })
    }

    await prisma.recurringTaskCompletion.deleteMany({
      where: { recurringTaskId: id, completedBy, dueDate },
    })

    return NextResponse.json({ message: "Complétion annulée" })
  } catch (error) {
    logger.error("Erreur annulation complétion", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
