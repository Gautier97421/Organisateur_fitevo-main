import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuth, verifyManagerOrAdmin } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

const includeRelations = {
  buyProduct: { select: { name: true } },
  getProduct: { select: { name: true } },
  targetProduct: { select: { name: true } },
}

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const gymId = searchParams.get("gym_id")
    const includeInactive = searchParams.get("include_inactive") === "true"

    const where: any = {}
    if (!includeInactive) where.isActive = true
    if (gymId) {
      where.OR = [{ gymId: null }, { gymId }]
    }

    const promotions = await prisma.promotion.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ data: promotions })
  } catch (error) {
    logger.error("Erreur récupération promotions", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyManagerOrAdmin(request)
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name, type, gymId,
      buyProductId, buyQuantity, getProductId, getQuantity,
      percentage, targetProductId, targetCategory,
    } = body

    if (!name || (type !== "buy_x_get_y" && type !== "percentage")) {
      return NextResponse.json({ error: "Nom et type de promotion sont obligatoires" }, { status: 400 })
    }
    if (type === "buy_x_get_y" && (!buyProductId || !buyQuantity || Number(buyQuantity) <= 0)) {
      return NextResponse.json({ error: "Produit acheté et quantité sont obligatoires" }, { status: 400 })
    }
    if (type === "percentage" && (!percentage || Number(percentage) <= 0 || Number(percentage) > 100)) {
      return NextResponse.json({ error: "Le pourcentage doit être compris entre 1 et 100" }, { status: 400 })
    }

    const promotion = await prisma.promotion.create({
      data: {
        name: name.trim(),
        type,
        gymId: gymId || null,
        buyProductId: type === "buy_x_get_y" ? buyProductId : null,
        buyQuantity: type === "buy_x_get_y" ? Number(buyQuantity) : null,
        getProductId: type === "buy_x_get_y" ? (getProductId || buyProductId) : null,
        getQuantity: type === "buy_x_get_y" ? (Number(getQuantity) || 1) : null,
        percentage: type === "percentage" ? Number(percentage) : null,
        targetProductId: type === "percentage" ? (targetProductId || null) : null,
        targetCategory: type === "percentage" ? (targetCategory || null) : null,
        createdBy: auth.userId,
      },
      include: includeRelations,
    })

    return NextResponse.json({ data: promotion }, { status: 201 })
  } catch (error) {
    logger.error("Erreur création promotion", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
