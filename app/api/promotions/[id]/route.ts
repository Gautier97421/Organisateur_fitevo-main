import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyManagerOrAdmin } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

const includeRelations = {
  buyProduct: { select: { name: true } },
  getProduct: { select: { name: true } },
  targetProduct: { select: { name: true } },
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyManagerOrAdmin(request)
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const {
      name, gymId, isActive,
      buyProductId, buyQuantity, getProductId, getQuantity,
      percentage, targetProductId, targetCategory,
    } = body

    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(gymId !== undefined && { gymId: gymId || null }),
        ...(isActive !== undefined && { isActive }),
        ...(buyProductId !== undefined && { buyProductId: buyProductId || null }),
        ...(buyQuantity !== undefined && { buyQuantity: Number(buyQuantity) || null }),
        ...(getProductId !== undefined && { getProductId: getProductId || null }),
        ...(getQuantity !== undefined && { getQuantity: Number(getQuantity) || null }),
        ...(percentage !== undefined && { percentage: percentage === null ? null : Number(percentage) }),
        ...(targetProductId !== undefined && { targetProductId: targetProductId || null }),
        ...(targetCategory !== undefined && { targetCategory: targetCategory || null }),
      },
      include: includeRelations,
    })

    return NextResponse.json({ data: promotion })
  } catch (error) {
    logger.error("Erreur mise à jour promotion", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyManagerOrAdmin(request)
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { id } = await params
    await prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ message: "Promotion désactivée" })
  } catch (error) {
    logger.error("Erreur suppression promotion", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
