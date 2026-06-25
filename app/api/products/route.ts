import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuth, verifyManagerOrAdmin } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

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

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })

    return NextResponse.json({ data: products })
  } catch (error) {
    logger.error("Erreur récupération produits", error)
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
    const { name, description, price, category, stock, gymId } = body

    if (!name || price === undefined || price === null) {
      return NextResponse.json({ error: "Nom et prix sont obligatoires" }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: Number(price),
        category: category?.trim() || null,
        stock: Number(stock) || 0,
        gymId: gymId || null,
        createdBy: auth.userId,
      },
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error) {
    logger.error("Erreur création produit", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
