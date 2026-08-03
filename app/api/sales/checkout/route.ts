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
    const { items, userEmail, userName, gymId, period, notes, declinedGifts } = body

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
    const catalog = [...products, ...extraProducts].map((p) => ({ id: p.id, name: p.name, price: p.price, category: p.category, stock: p.stock, trackStock: p.trackStock }))

    const declinedGiftQuantities: Record<string, number> | undefined =
      declinedGifts && typeof declinedGifts === "object" ? declinedGifts : undefined

    const result = applyPromotions(cart, promotions as PromotionRule[], catalog, gymId || null, declinedGiftQuantities)

    const now = new Date()
    const saleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const stockDeltas = new Map<string, number>()
    for (const line of result.lines) {
      stockDeltas.set(line.productId, (stockDeltas.get(line.productId) || 0) + line.quantity)
    }

    const sales = await prisma.$transaction(async (tx) => {
      // Vérifie le stock réel (source de vérité serveur) avant de créer quoi que ce soit :
      // le panier client ne doit jamais pouvoir vendre plus que ce qui est disponible, y compris
      // en cas de vente concurrente sur le même article.
      const freshProducts = new Map<string, { stock: number; trackStock: boolean; name: string }>()
      for (const [productId, qty] of stockDeltas) {
        const fresh = await tx.product.findUnique({ where: { id: productId } })
        if (!fresh) continue
        if (fresh.trackStock && fresh.stock < qty) {
          throw new Error(`STOCK_INSUFFICIENT:${fresh.name}`)
        }
        freshProducts.set(productId, fresh)
      }

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
        const fresh = freshProducts.get(productId)
        if (fresh && fresh.trackStock) {
          await tx.product.update({ where: { id: productId }, data: { stock: fresh.stock - qty } })
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
    if (error instanceof Error && error.message.startsWith("STOCK_INSUFFICIENT:")) {
      const productName = error.message.slice("STOCK_INSUFFICIENT:".length)
      return NextResponse.json({ error: `Stock insuffisant pour ${productName}` }, { status: 409 })
    }
    logger.error("Erreur checkout vente", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
