import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-middleware"
import { applyPromotions, type CartLine, type PromotionRule } from "@/lib/promotions"
import logger from "@/lib/logger"

/**
 * POST /api/sales/checkout
 * Reçoit le panier brut { items: [{productId, quantity}], userEmail, userName, gymId, period, notes }.
 * Recharge produits + promotions actives depuis la base et calcule les lignes cadeaux / remises
 * côté serveur (source de vérité), puis crée toutes les ventes et décrémente les stocks en une transaction.
 */
export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  try {
    const body = await request.json()
    const { items, userEmail, userName, gymId, period, notes } = body

    if (!Array.isArray(items) || items.length === 0 || !userEmail) {
      return NextResponse.json({ error: "items et userEmail sont obligatoires" }, { status: 400 })
    }

    const requestedIds = [...new Set(items.map((i: any) => String(i.productId)))]
    const products = await prisma.product.findMany({ where: { id: { in: requestedIds } } })
    const productsById = new Map(products.map((p) => [p.id, p]))

    const cart: CartLine[] = []
    for (const item of items) {
      const product = productsById.get(String(item.productId))
      const quantity = Math.max(1, Number(item.quantity))
      if (!product) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
      cart.push({ product: { id: product.id, name: product.name, price: product.price, category: product.category }, quantity })
    }

    const promotions = await prisma.promotion.findMany({
      where: { isActive: true, OR: [{ gymId: null }, { gymId: gymId || undefined }] },
    })

    // Catalogue élargi : inclut les produits offerts potentiellement absents du panier (ex: serviette).
    const promoProductIds = new Set<string>()
    for (const p of promotions as PromotionRule[]) {
      if (p.getProductId) promoProductIds.add(p.getProductId)
      if (p.targetProductId) promoProductIds.add(p.targetProductId)
    }
    const extraIds = [...promoProductIds].filter((id) => !productsById.has(id))
    const extraProducts = extraIds.length ? await prisma.product.findMany({ where: { id: { in: extraIds } } }) : []
    const catalog = [...products, ...extraProducts].map((p) => ({ id: p.id, name: p.name, price: p.price, category: p.category }))

    const result = applyPromotions(cart, promotions as PromotionRule[], catalog, gymId || null)

    const now = new Date()
    const saleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const stockDeltas = new Map<string, number>()
    for (const line of result.lines) {
      stockDeltas.set(line.productId, (stockDeltas.get(line.productId) || 0) + line.quantity)
    }

    const sales = await prisma.$transaction(async (tx) => {
      const created = []
      for (const line of result.lines) {
        const sale = await tx.sale.create({
          data: {
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
            userEmail,
            userName: userName || userEmail,
            gymId: gymId || null,
            period: period || null,
            saleDate: now,
            saleMonth,
            notes: notes?.trim() || null,
            promotionId: line.promotionId,
            isGift: line.isGift,
            discount: line.discount,
          },
        })
        created.push(sale)
      }

      for (const [productId, qty] of stockDeltas) {
        const fresh = await tx.product.findUnique({ where: { id: productId } })
        if (fresh && fresh.trackStock && fresh.stock > 0) {
          await tx.product.update({ where: { id: productId }, data: { stock: Math.max(0, fresh.stock - qty) } })
        }
      }

      return created
    })

    return NextResponse.json({
      data: {
        sales,
        subtotal: result.subtotal,
        totalDiscount: result.totalDiscount,
        total: result.total,
        appliedPromotions: result.appliedPromotions,
      },
    }, { status: 201 })
  } catch (error) {
    logger.error("Erreur checkout vente", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
