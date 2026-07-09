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
    const [setting, usage, fileCount] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { id: "singleton" } }),
      prisma.attachment.aggregate({ _sum: { size: true } }),
      prisma.attachment.count(),
    ])

    return NextResponse.json({
      data: {
        quotaMb: setting?.storageQuotaMb ?? null,
        usedBytes: usage._sum.size ?? 0,
        fileCount,
      },
    })
  } catch (error) {
    logger.error("Erreur récupération quota de stockage", error)
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
    const quotaMb = body.quotaMb === null || body.quotaMb === undefined ? null : Number(body.quotaMb)
    if (quotaMb !== null && (!Number.isFinite(quotaMb) || quotaMb <= 0)) {
      return NextResponse.json({ error: "Quota invalide" }, { status: 400 })
    }

    const setting = await prisma.systemSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", storageQuotaMb: quotaMb, updatedBy: auth.userId },
      update: { storageQuotaMb: quotaMb, updatedBy: auth.userId },
    })

    return NextResponse.json({ data: { quotaMb: setting.storageQuotaMb } })
  } catch (error) {
    logger.error("Erreur mise à jour quota de stockage", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
