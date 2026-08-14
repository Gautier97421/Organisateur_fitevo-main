import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuthWithRole } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

/**
 * Suppression d'un pointage — réservée au superadmin.
 *
 * Un pointage est une donnée de temps de travail (base de paie potentielle) : ni un manager
 * ni un admin ne doivent pouvoir en effacer la trace. Sert à nettoyer des pointages de test
 * ou une erreur manifeste.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }
  if (auth.role !== "superadmin") {
    return NextResponse.json(
      { error: "Seul un superadmin peut supprimer un pointage." },
      { status: 403 },
    )
  }

  try {
    const { id } = await params
    await prisma.timeEntry.delete({ where: { id } })
    return NextResponse.json({ message: "Pointage supprimé" })
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Pointage introuvable" }, { status: 404 })
    }
    logger.error("Erreur suppression pointage", error)
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
