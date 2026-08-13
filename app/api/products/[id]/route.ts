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
    const { name, description, price, category, stock, gymId, isActive, trackStock } = body

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
        ...(trackStock !== undefined && { trackStock }),
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

    await prisma.$transaction(async (tx) => {
      // Une promo qui vise cet article n'a plus d'objet une fois l'article supprimé :
      // la garder reviendrait à laisser une règle qui s'applique à « un article » vide.
      await tx.promotion.deleteMany({
        where: {
          OR: [{ buyProductId: id }, { getProductId: id }, { targetProductId: id }],
        },
      })

      // Les ventes déjà encaissées survivent : sales.product_id passe à NULL
      // (contrainte ON DELETE SET NULL), le nom et les montants restent figés dessus.
      await tx.product.delete({ where: { id } })
    })

    return NextResponse.json({ message: "Produit supprimé" })
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }
    logger.error("Erreur suppression produit", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
