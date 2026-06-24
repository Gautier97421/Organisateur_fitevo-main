import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-middleware"
import logger from "@/lib/logger"

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month") // YYYY-MM
    const gymId = searchParams.get("gym_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    const where: any = {}
    if (month) where.saleMonth = month
    if (gymId) where.gymId = gymId
    if (startDate || endDate) {
      where.saleDate = {}
      if (startDate) where.saleDate.gte = new Date(startDate)
      if (endDate) where.saleDate.lte = new Date(endDate + "T23:59:59.999Z")
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { saleDate: "desc" },
      include: { product: { select: { name: true, category: true } } },
    })

    return NextResponse.json({ data: sales })
  } catch (error) {
    logger.error("Erreur récupération ventes", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const body = await request.json()
    const { productId, quantity, userEmail, userName, gymId, period, notes } = body

    if (!productId || !quantity || !userEmail) {
      return NextResponse.json({ error: "productId, quantity et userEmail sont obligatoires" }, { status: 400 })
    }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })

    const qty = Math.max(1, Number(quantity))
    const total = product.price * qty
    const now = new Date()
    const saleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const sale = await prisma.sale.create({
      data: {
        productId,
        productName: product.name,
        quantity: qty,
        unitPrice: product.price,
        total,
        userEmail,
        userName: userName || userEmail,
        gymId: gymId || null,
        period: period || null,
        saleDate: now,
        saleMonth,
        notes: notes?.trim() || null,
      },
    })

    if (product.stock > 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { stock: Math.max(0, product.stock - qty) },
      })
    }

    return NextResponse.json({ data: sale }, { status: 201 })
  } catch (error) {
    logger.error("Erreur création vente", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
