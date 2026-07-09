/**
 * Moteur de calcul des promotions (BOGO type "X acheté Y offert" et remises %).
 *
 * Fonction pure (pas d'accès fs/prisma) : utilisée à la fois côté client (aperçu
 * du panier employé) et côté serveur (calcul faisant foi lors du checkout).
 */

export interface PromoProduct {
  id: string
  name: string
  price: number
  category?: string | null
}

export interface PromotionRule {
  id: string
  name: string
  type: "buy_x_get_y" | "percentage"
  isActive: boolean
  gymId?: string | null
  buyProductId?: string | null
  buyQuantity?: number | null
  getProductId?: string | null
  getQuantity?: number | null
  percentage?: number | null
  targetProductId?: string | null
  targetCategory?: string | null
  // Relations optionnelles (fournies par l'API pour l'affichage des descriptions)
  buyProduct?: { name: string } | null
  getProduct?: { name: string } | null
  targetProduct?: { name: string } | null
}

export interface CartLine {
  product: PromoProduct
  quantity: number
}

export interface ComputedLine {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
  isGift: boolean
  discount: number
  promotionId: string | null
  promotionName: string | null
}

export interface PromotionResult {
  lines: ComputedLine[]
  subtotal: number
  totalDiscount: number
  total: number
  appliedPromotions: { id: string; name: string; label: string }[]
}

function isPromoInScope(promo: PromotionRule, gymId?: string | null): boolean {
  if (!promo.isActive) return false
  if (!promo.gymId) return true
  return promo.gymId === (gymId || null)
}

function baseLines(cart: CartLine[]): ComputedLine[] {
  return cart
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      total: item.product.price * item.quantity,
      isGift: false,
      discount: 0,
      promotionId: null,
      promotionName: null,
    }))
}

function applyBogoPromotions(
  lines: ComputedLine[],
  promotions: PromotionRule[],
  catalogById: Map<string, PromoProduct>,
  gymId: string | null | undefined,
  applied: Map<string, { id: string; name: string; label: string }>
) {
  const bogoPromos = promotions.filter((p) => p.type === "buy_x_get_y" && isPromoInScope(p, gymId))

  for (const promo of bogoPromos) {
    if (!promo.buyProductId || !promo.buyQuantity || promo.buyQuantity <= 0) continue
    const getQty = promo.getQuantity && promo.getQuantity > 0 ? promo.getQuantity : 1
    const getProductId = promo.getProductId || promo.buyProductId
    const sameProduct = getProductId === promo.buyProductId

    const buyLine = lines.find((l) => l.productId === promo.buyProductId && !l.isGift)
    const buyQtyInCart = buyLine?.quantity ?? 0
    if (buyQtyInCart <= 0) continue

    let freeUnits: number
    if (sameProduct) {
      // "X acheté(s) Y offert(s)" sur le même article : groupes de (X+Y) unités, Y gratuites par groupe.
      const groupSize = promo.buyQuantity + getQty
      const groups = Math.floor(buyQtyInCart / groupSize)
      freeUnits = groups * getQty
    } else {
      // Offre croisée (ex : 2 produits achetés -> 1 serviette offerte) : pas de regroupement, chaque palier de X déclenche Y offerts.
      const groups = Math.floor(buyQtyInCart / promo.buyQuantity)
      freeUnits = groups * getQty
    }
    if (freeUnits <= 0) continue

    const giftProduct = catalogById.get(getProductId)
    if (!giftProduct) continue

    if (sameProduct && buyLine) {
      buyLine.quantity -= freeUnits
      buyLine.total = buyLine.unitPrice * buyLine.quantity
    } else {
      const existingGetLine = lines.find((l) => l.productId === getProductId && !l.isGift)
      if (existingGetLine) {
        existingGetLine.quantity = Math.max(0, existingGetLine.quantity - freeUnits)
        existingGetLine.total = existingGetLine.unitPrice * existingGetLine.quantity
      }
    }

    lines.push({
      productId: getProductId,
      productName: giftProduct.name,
      quantity: freeUnits,
      unitPrice: 0,
      total: 0,
      isGift: true,
      discount: freeUnits * giftProduct.price,
      promotionId: promo.id,
      promotionName: promo.name,
    })

    applied.set(promo.id, { id: promo.id, name: promo.name, label: describePromotion(promo) })
  }
}

export function applyPromotions(
  cart: CartLine[],
  promotions: PromotionRule[],
  catalog: PromoProduct[],
  gymId?: string | null
): PromotionResult {
  const catalogById = new Map(catalog.map((p) => [p.id, p]))
  const categoryById = new Map(catalog.map((p) => [p.id, p.category || null]))
  const lines = baseLines(cart)
  const applied = new Map<string, { id: string; name: string; label: string }>()

  const subtotal = lines.reduce((sum, l) => sum + l.total, 0)

  // Remises % (produit précis, catégorie, ou tous les articles)
  const percentagePromos = promotions.filter((p) => p.type === "percentage" && isPromoInScope(p, gymId))
  for (const promo of percentagePromos) {
    const pct = promo.percentage
    if (!pct || pct <= 0) continue
    const clampedPct = Math.min(pct, 100)

    for (const line of lines) {
      if (line.isGift) continue
      let matches = false
      if (promo.targetProductId) {
        matches = line.productId === promo.targetProductId
      } else if (promo.targetCategory) {
        matches = categoryById.get(line.productId) === promo.targetCategory
      } else {
        matches = true // pas de cible = tous les articles
      }
      if (!matches) continue

      const lineDiscount = line.total * (clampedPct / 100)
      if (lineDiscount <= 0) continue
      line.total -= lineDiscount
      line.unitPrice = line.quantity > 0 ? line.total / line.quantity : 0
      line.discount += lineDiscount
      line.promotionId = promo.id
      line.promotionName = promo.name
      applied.set(promo.id, { id: promo.id, name: promo.name, label: describePromotion(promo) })
    }
  }

  // Offres "X acheté(s) Y offert(s)"
  applyBogoPromotions(lines, promotions, catalogById, gymId, applied)

  const totalDiscount = lines.reduce((sum, l) => sum + l.discount, 0)
  const total = lines.reduce((sum, l) => sum + l.total, 0)

  return {
    lines: lines.filter((l) => l.quantity > 0),
    subtotal,
    totalDiscount,
    total,
    appliedPromotions: Array.from(applied.values()),
  }
}

export function describePromotion(promo: PromotionRule): string {
  if (promo.type === "buy_x_get_y") {
    const buyQty = promo.buyQuantity ?? 1
    const getQty = promo.getQuantity ?? 1
    const buyName = promo.buyProduct?.name || "article"
    const getProductId = promo.getProductId || promo.buyProductId
    const sameProduct = getProductId === promo.buyProductId
    if (sameProduct) {
      return `${buyName} : ${buyQty} acheté${buyQty > 1 ? "s" : ""} → ${getQty} offert${getQty > 1 ? "s" : ""}`
    }
    const getName = promo.getProduct?.name || "article"
    return `${buyQty} × ${buyName} acheté${buyQty > 1 ? "s" : ""} → ${getQty} × ${getName} offert${getQty > 1 ? "s" : ""}`
  }

  const pct = promo.percentage ?? 0
  if (promo.targetProductId) {
    return `-${pct}% sur ${promo.targetProduct?.name || "un article"}`
  }
  if (promo.targetCategory) {
    return `-${pct}% sur ${promo.targetCategory}`
  }
  return `-${pct}% sur tous les articles`
}
