import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyManagerOrAdmin } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyManagerOrAdmin(request)
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, price, category, stock, gymId, isActive } = body

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(price !== undefined && { price: Number(price) }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(gymId !== undefined && { gymId: gymId || null }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ data: product })
  } catch (error) {
    logger.error("Erreur mise à jour produit", error)
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
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ message: "Produit archivé" })
  } catch (error) {
    logger.error("Erreur suppression produit", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
