import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuthWithRole } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

export async function GET(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth || !["admin", "superadmin"].includes(auth.role)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  try {
    const setting = await prisma.systemSetting.findUnique({ where: { id: "singleton" } })
    // Pas de ligne en base = comportement par défaut = activé.
    return NextResponse.json({ data: { emailEnabled: setting?.emailEnabled ?? true } })
  } catch (error) {
    logger.error("Erreur récupération paramètre email", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth || !["admin", "superadmin"].includes(auth.role)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const emailEnabled = Boolean(body.emailEnabled)

    const setting = await prisma.systemSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", emailEnabled, updatedBy: auth.userId },
      update: { emailEnabled, updatedBy: auth.userId },
    })

    return NextResponse.json({ data: { emailEnabled: setting.emailEnabled } })
  } catch (error) {
    logger.error("Erreur mise à jour paramètre email", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
