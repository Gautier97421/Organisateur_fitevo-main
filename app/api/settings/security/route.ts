import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuthWithRole } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

// Paramètres de sécurité réservés au superadmin.
export async function GET(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth || auth.role !== "superadmin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  try {
    const setting = await prisma.systemSetting.findUnique({ where: { id: "singleton" } })
    // Pas de ligne en base = comportement par défaut = jeton non exigé.
    return NextResponse.json({
      data: { activationTokenRequired: setting?.activationTokenRequired ?? false },
    })
  } catch (error) {
    logger.error("Erreur récupération paramètre sécurité", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth || auth.role !== "superadmin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const activationTokenRequired = Boolean(body.activationTokenRequired)

    const setting = await prisma.systemSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", activationTokenRequired, updatedBy: auth.userId },
      update: { activationTokenRequired, updatedBy: auth.userId },
    })

    logger.info(
      `Jeton d'activation ${setting.activationTokenRequired ? "exigé" : "non exigé"} — modifié par ${auth.userId}`,
    )

    return NextResponse.json({
      data: { activationTokenRequired: setting.activationTokenRequired },
    })
  } catch (error) {
    logger.error("Erreur mise à jour paramètre sécurité", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
