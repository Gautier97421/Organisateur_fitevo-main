import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

/**
 * GET /api/db/cash-register-entries/opening-status?gym_id=…&date=YYYY-MM-DD
 *
 * Le comptage d'ouverture se fait UNE seule fois par jour et par salle : les employés qui
 * prennent leur poste ensuite n'ont pas à le refaire (entre l'ouverture et la fermeture, les
 * ventes tracent déjà les mouvements d'argent).
 *
 * Cette route répond simplement "déjà fait ou non" (+ par qui, et à quelle heure) et reste
 * ouverte à tout employé authentifié — contrairement au récap complet, qui expose les montants
 * et demeure réservé aux managers.
 */
export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const gymId = searchParams.get("gym_id")
    const dateParam = searchParams.get("date")

    const day = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? new Date(`${dateParam}T00:00:00`)
      : new Date()
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)

    const entry = await prisma.cashRegisterEntry.findFirst({
      where: {
        entryDate: { gte: dayStart, lte: dayEnd },
        gymId: gymId || null,
        notes: { contains: "[OUVERTURE]" },
      },
      orderBy: { entryDate: "asc" },
    })

    return NextResponse.json({
      data: entry
        ? {
            done: true,
            at: entry.entryDate.toISOString(),
            userName: entry.userName,
            userEmail: entry.userEmail,
          }
        : { done: false, at: null, userName: null, userEmail: null },
    })
  } catch (error) {
    logger.error("Erreur statut ouverture caisse", error)
    return NextResponse.json({ error: "Impossible de vérifier l'ouverture de caisse" }, { status: 500 })
  }
}
