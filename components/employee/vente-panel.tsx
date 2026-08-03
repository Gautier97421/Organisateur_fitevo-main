"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  ShoppingCart, Plus, Minus, Trash2, CheckCircle, Package, Search,
  AlertTriangle, Loader2, ShoppingBag, Gift, Tag,
} from "lucide-react"
import { toast } from "sonner"
import { applyPromotions, type PromotionRule } from "@/lib/promotions"

interface Product {
  id: string
  name: string
  description?: string | null
  price: number
  category?: string | null
  stock: number
  trackStock: boolean
}

interface CartItem {
  product: Product
  quantity: number
}

interface VentePanelProps {
  period: "matin" | "aprem" | "journee"
  gymId?: string
  gymName?: string
  userEmail: string
  userName: string
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

// Le panier est conservé en session (par période + salle) pour ne pas être perdu quand
// l'employé navigue vers un autre écran (ex: Ventes & Stock pour ajuster le stock) puis
// revient finaliser sa vente en cours.
function cartStorageKey(userEmail: string, period: string, gymId?: string) {
  return `vente_cart_${userEmail}_${period}_${gymId || "none"}`
}

export function VentePanel({ period, gymId, gymName, userEmail, userName }: VentePanelProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<PromotionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = window.sessionStorage.getItem(cartStorageKey(userEmail, period, gymId))
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed // ancien format (panier seul)
      return Array.isArray(parsed?.cart) ? parsed.cart : []
    } catch {
      return []
    }
  })
  // Quantités d'articles offerts que l'employé/client a explicitement refusées (droit de ne pas
  // prendre le produit gratuit) — indexé par promotion, conservé avec le panier.
  const [declinedGifts, setDeclinedGifts] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = window.sessionStorage.getItem(cartStorageKey(userEmail, period, gymId))
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && !Array.isArray(parsed) && parsed.declinedGifts ? parsed.declinedGifts : {}
    } catch {
      return {}
    }
  })
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [successCount, setSuccessCount] = useState(0)

  useEffect(() => {
    const key = cartStorageKey(userEmail, period, gymId)
    try {
      if (cart.length > 0) {
        window.sessionStorage.setItem(key, JSON.stringify({ cart, declinedGifts }))
      } else {
        window.sessionStorage.removeItem(key)
      }
    } catch {
      // Stockage indisponible (mode privé, quota…) : le panier reste fonctionnel en mémoire.
    }
  }, [cart, declinedGifts, userEmail, period, gymId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        let url = "/api/products"
        if (gymId) url += `?gym_id=${gymId}`
        const res = await fetch(url, { credentials: "same-origin" })
        const json = res.ok ? await res.json() : { data: [] }
        setProducts(Array.isArray(json.data) ? json.data : [])

        let promoUrl = "/api/promotions"
        if (gymId) promoUrl += `?gym_id=${gymId}`
        const promoRes = await fetch(promoUrl, { credentials: "same-origin" })
        const promoJson = promoRes.ok ? await promoRes.json() : { data: [] }
        setPromotions(Array.isArray(promoJson.data) ? promoJson.data : [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [gymId])

  const filtered = useMemo(() => {
    let list = products
    if (selectedCategory) list = list.filter((p) => (p.category || "Autres") === selectedCategory)
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    )
  }, [products, search, selectedCategory])

  // Inclut le seau "Autres" (articles sans catégorie) : sinon un seul vrai libellé de catégorie ne
  // laisse jamais apparaître le filtre alors qu'il y a bien 2 groupes visibles dans le catalogue.
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category || "Autres"))
    return Array.from(cats).sort()
  }, [products])

  const isOutOfStock = (p: Product) => p.trackStock && p.stock === 0

  // Par catégorie : articles en stock (toujours visibles) séparés des ruptures de stock
  // (repliées par défaut, comme les articles archivés dans Ventes & Stock), pour simplifier
  // la saisie d'une vente.
  const grouped = useMemo(() => {
    const map: Record<string, { inStock: Product[]; outOfStock: Product[] }> = {}
    filtered.forEach((p) => {
      const cat = p.category || "Autres"
      if (!map[cat]) map[cat] = { inStock: [], outOfStock: [] }
      if (isOutOfStock(p)) map[cat].outOfStock.push(p)
      else map[cat].inStock.push(p)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // Associe chaque produit aux promotions actives qui le concernent, pour afficher un badge sur
  // le catalogue — sinon les promos restent invisibles tant qu'on n'a pas déjà ajouté l'article
  // au panier.
  const productPromoMap = useMemo(() => {
    const map = new Map<string, PromotionRule[]>()
    const add = (productId: string, promo: PromotionRule) => {
      const arr = map.get(productId) || []
      arr.push(promo)
      map.set(productId, arr)
    }
    for (const promo of promotions) {
      if (promo.type === "percentage") {
        if (promo.targetProductId) {
          add(promo.targetProductId, promo)
        } else if (promo.targetCategory) {
          for (const p of products) if (p.category === promo.targetCategory) add(p.id, promo)
        }
      } else if (promo.type === "buy_x_get_y" && promo.buyProductId) {
        add(promo.buyProductId, promo)
      }
    }
    return map
  }, [promotions, products])

  // Entitlement complet (sans tenir compte des refus) : sert à savoir combien d'unités déclarer
  // refusées quand l'employé retire un article offert du panier.
  const rawPromoResult = useMemo(
    () => applyPromotions(
      cart.map((item) => ({ product: item.product, quantity: item.quantity })),
      promotions,
      products,
      gymId || null
    ),
    [cart, promotions, products, gymId]
  )
  const promoResult = useMemo(
    () => applyPromotions(
      cart.map((item) => ({ product: item.product, quantity: item.quantity })),
      promotions,
      products,
      gymId || null,
      declinedGifts
    ),
    [cart, promotions, products, gymId, declinedGifts]
  )
  const cartTotal = promoResult.total
  const cartCount = cart.reduce((a, item) => a + item.quantity, 0)

  // Un refus d'article offert n'a de sens que pour le "cycle" d'achat en cours : si l'article
  // acheté correspondant repasse à 0 (retiré ligne par ligne, sans forcément faire "Vider"), on
  // oublie le refus pour que le prochain achat déclenche à nouveau l'offre normalement.
  useEffect(() => {
    setDeclinedGifts((prev) => {
      if (Object.keys(prev).length === 0) return prev
      let changed = false
      const next = { ...prev }
      for (const promo of promotions) {
        if (promo.type !== "buy_x_get_y" || !promo.buyProductId || !(promo.id in next)) continue
        const buyQtyInCart = cart.find((i) => i.product.id === promo.buyProductId)?.quantity || 0
        if (buyQtyInCart <= 0) {
          delete next[promo.id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [cart, promotions])

  const addQuantityToCart = (product: Product, qty: number) => {
    if (qty <= 0) return
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      const currentQty = existing?.quantity || 0
      let nextQty = currentQty + qty
      if (product.trackStock) {
        if (currentQty >= product.stock) {
          toast.error(`Stock insuffisant pour ${product.name}`)
          return prev
        }
        if (nextQty > product.stock) {
          nextQty = product.stock
          toast.error(`Quantité limitée au stock disponible pour ${product.name} (${product.stock})`)
        }
      }
      if (existing) {
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: nextQty } : i)
      }
      return [...prev, { product, quantity: nextQty }]
    })
  }

  const addToCart = (product: Product) => addQuantityToCart(product, 1)

  // Quantité du produit acheté nécessaire dans le panier pour déclencher UN palier de l'offre :
  // l'offert s'ajoute toujours EN PLUS de ce qui est acheté (ex: "2 achetées → 1 offerte" : ajouter
  // 2 au panier suffit, la 3e s'ajoute automatiquement), que le produit offert soit le même ou non.
  const bogoThreshold = (promo: PromotionRule): number => promo.buyQuantity || 1

  // Le produit offert d'une offre "X acheté(s) Y offert(s)" est-il en rupture de stock ? Dans ce
  // cas l'offre ne peut rien donner de gratuit (le moteur de promotions plafonne à 0), il faut donc
  // le signaler avant que l'employé n'appuie sur "Offre" plutôt que de laisser l'ajout se faire en
  // silence sans le cadeau attendu.
  const isGiftOutOfStock = (promo: PromotionRule): boolean => {
    if (promo.type !== "buy_x_get_y") return false
    const getProductId = promo.getProductId || promo.buyProductId
    const giftProduct = products.find((p) => p.id === getProductId)
    return !!giftProduct && giftProduct.trackStock && giftProduct.stock <= 0
  }

  // Retire (refuse) l'article offert d'une promo : le client a le droit de ne pas le prendre.
  const declineGift = (promotionId: string) => {
    const rawEntitled = rawPromoResult.lines.find((l) => l.isGift && l.promotionId === promotionId)?.quantity || 0
    setDeclinedGifts((prev) => ({ ...prev, [promotionId]: rawEntitled }))
  }

  // Bouton "Utiliser cette offre" : complète le panier jusqu'au prochain palier pour déclencher
  // la promo immédiatement. Une remise % sans produit précis (catégorie / tous les articles)
  // s'applique déjà automatiquement à tout le panier, elle n'a pas besoin de bouton.
  const usePromotion = (promo: PromotionRule) => {
    if (promo.type === "buy_x_get_y" && promo.buyProductId) {
      const buyProduct = products.find((p) => p.id === promo.buyProductId)
      if (!buyProduct) return
      const threshold = bogoThreshold(promo)
      const inCartQty = cart.find((i) => i.product.id === promo.buyProductId)?.quantity || 0
      const remainder = inCartQty % threshold
      const toAdd = remainder === 0 ? threshold : threshold - remainder
      addQuantityToCart(buyProduct, toAdd)
    } else if (promo.type === "percentage" && promo.targetProductId) {
      const targetProduct = products.find((p) => p.id === promo.targetProductId)
      if (!targetProduct) return
      if (!cart.find((i) => i.product.id === targetProduct.id)) {
        addQuantityToCart(targetProduct, 1)
      }
    }
  }

  // Suggestions "offre disponible" : le panier contient déjà (en partie) le produit d'appel
  // d'une offre X-achetés-Y-offerts, mais pas encore assez pour atteindre le PROCHAIN palier —
  // même si un palier précédent est déjà déclenché (ex : 3 achetées sur une offre "2 achetées → 1
  // offerte" : la 1ère offerte est déjà là, mais il en manque encore 1 pour la 2e).
  const promoOpportunities = useMemo(() => {
    const opportunities: { promo: PromotionRule; buyProduct: Product; missing: number }[] = []
    for (const promo of promotions) {
      if (promo.type !== "buy_x_get_y" || !promo.buyProductId || !promo.buyQuantity) continue
      if (isGiftOutOfStock(promo)) continue // rien à gagner à suggérer un palier qui ne donnera rien
      const buyProduct = products.find((p) => p.id === promo.buyProductId)
      if (!buyProduct) continue
      const inCartQty = cart.find((i) => i.product.id === promo.buyProductId)?.quantity || 0
      if (inCartQty <= 0) continue
      const threshold = bogoThreshold(promo)
      const missing = threshold - (inCartQty % threshold)
      if (missing > 0 && missing < threshold) opportunities.push({ promo, buyProduct, missing })
    }
    return opportunities
  }, [promotions, cart, products])

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== productId) return i
          let next = i.quantity + delta
          if (delta > 0 && i.product.trackStock) next = Math.min(next, i.product.stock)
          return { ...i, quantity: next }
        })
        .filter((i) => i.quantity > 0)
    )
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  const renderProductTile = (product: Product) => {
    const inCart = cart.find((i) => i.product.id === product.id)
    const outOfStock = isOutOfStock(product)
    // Stock réellement disponible pour un ajout supplémentaire : stock physique moins ce qui est
    // déjà dans le panier — sinon rien n'empêche de dépasser le stock réel avant validation.
    const available = product.trackStock ? Math.max(0, product.stock - (inCart?.quantity || 0)) : Infinity
    const atLimit = product.trackStock && available <= 0
    const productPromos = productPromoMap.get(product.id) || []
    return (
      <div
        key={product.id}
        className={[
          "rounded-xl border p-3 flex items-center justify-between gap-3 transition-all",
          outOfStock ? "opacity-50 bg-gray-50 border-gray-200" : "bg-white border-gray-200 hover:border-red-200",
          inCart ? "border-red-200 bg-red-50/30" : "",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{product.name}</span>
            {outOfStock && (
              <Badge className="text-xs bg-red-100 text-red-700 flex-shrink-0">
                <AlertTriangle className="w-3 h-3 mr-1" />Rupture
              </Badge>
            )}
            {product.trackStock && !outOfStock && available <= 5 && (
              <Badge className={`text-xs flex-shrink-0 ${available === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                {available} restant(s){inCart ? " (panier inclus)" : ""}
              </Badge>
            )}
            {productPromos.map((promo) => {
              const actionable = (promo.type === "buy_x_get_y" && !!promo.buyProductId) || (promo.type === "percentage" && !!promo.targetProductId)
              const giftUnavailable = isGiftOutOfStock(promo)
              return (
                <button
                  key={promo.id}
                  type="button"
                  title={
                    giftUnavailable
                      ? `${promo.name} — l'article offert est en rupture de stock, l'offre ne peut pas être appliquée`
                      : `${promo.name} — cliquer pour appliquer l'offre`
                  }
                  disabled={outOfStock || giftUnavailable}
                  onClick={() => (actionable ? usePromotion(promo) : addToCart(product))}
                  className={[
                    "text-xs font-semibold rounded-full px-2 py-0.5 flex items-center flex-shrink-0 transition-colors disabled:pointer-events-none",
                    giftUnavailable
                      ? "bg-red-100 text-red-700 opacity-80"
                      : "bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50",
                  ].join(" ")}
                >
                  {giftUnavailable ? (
                    <AlertTriangle className="w-3 h-3 mr-1" />
                  ) : promo.type === "buy_x_get_y" ? (
                    <Gift className="w-3 h-3 mr-1" />
                  ) : (
                    <Tag className="w-3 h-3 mr-1" />
                  )}
                  {giftUnavailable ? "Offre : article offert en rupture" : promo.type === "percentage" ? `-${promo.percentage}%` : "Offre"}
                </button>
              )
            })}
          </div>
          {product.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{product.description}</p>
          )}
          <p className="text-sm font-bold text-red-600 mt-1">{fmt(product.price)}</p>
        </div>

        {inCart ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => updateQty(product.id, -1)}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-bold text-gray-900">{inCart.quantity}</span>
            <button
              onClick={() => updateQty(product.id, 1)}
              disabled={atLimit}
              className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => !atLimit && addToCart(product)}
            disabled={atLimit}
            className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setSubmitting(true)

    try {
      const res = await fetch("/api/sales/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          userEmail,
          userName,
          gymId: gymId || null,
          period,
          declinedGifts,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || "La vente n'a pas pu être enregistrée")
      }
      const json = await res.json()
      const count = Array.isArray(json?.data?.sales) ? json.data.sales.length : cart.length
      setCart([])
      setDeclinedGifts({})
      setSuccessCount((c) => c + count)
      toast.success(`Vente enregistrée avec succès (${count} ligne(s))`)
      // Rafraîchir le stock
      const stockRes = await fetch(gymId ? `/api/products?gym_id=${gymId}` : "/api/products", { credentials: "same-origin" })
      const stockJson = stockRes.ok ? await stockRes.json() : { data: [] }
      setProducts(Array.isArray(stockJson.data) ? stockJson.data : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "La vente n'a pas pu être enregistrée")
      // Le stock a pu changer entre-temps (vente concurrente) : on le recharge pour rester cohérent.
      try {
        const stockRes = await fetch(gymId ? `/api/products?gym_id=${gymId}` : "/api/products", { credentials: "same-origin" })
        const stockJson = stockRes.ok ? await stockRes.json() : { data: [] }
        setProducts(Array.isArray(stockJson.data) ? stockJson.data : [])
      } catch {
        // Rafraîchissement best-effort
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-base">Ventes</h2>
          <p className="text-xs text-gray-500">{gymName ? `${gymName} · ` : ""}Période en cours</p>
        </div>
        {successCount > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <CheckCircle className="w-3.5 h-3.5" />
            {successCount} vente(s) enregistrée(s) aujourd'hui
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">Aucun article disponible à la vente.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un article…"
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Filtre par catégorie */}
          {categories.length > 1 && (
            <Select value={selectedCategory || "_all"} onValueChange={(v) => setSelectedCategory(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-56 rounded-xl">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes les catégories</SelectItem>
                {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Catalogue */}
          {grouped.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucun article correspondant</p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([cat, { inStock, outOfStock }]) => (
                <div key={cat}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</p>
                  {inStock.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {inStock.map((product) => renderProductTile(product))}
                    </div>
                  )}
                  {outOfStock.length > 0 && (
                    <details className={inStock.length > 0 ? "mt-2" : undefined}>
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                        {outOfStock.length} article(s) en rupture de stock
                      </summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {outOfStock.map((product) => renderProductTile(product))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Panier */}
      {cart.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-red-600" />
              <span className="font-semibold text-gray-900 text-sm">Panier ({cartCount} article{cartCount > 1 ? "s" : ""})</span>
            </div>
            <button
              onClick={() => { setCart([]); setDeclinedGifts({}) }}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              Vider
            </button>
          </div>

          <ul className="space-y-2">
            {cart.map((item) => (
              <li key={item.product.id} className="flex items-center justify-between text-sm gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-white">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-bold text-gray-900">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.product.id, 1)}
                      disabled={item.product.trackStock && item.quantity >= item.product.stock}
                      className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="truncate text-gray-800">{item.product.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-semibold text-gray-900">{fmt(item.product.price * item.quantity)}</span>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {/* Articles offerts par une promo (ex: offre croisée) : n'ont pas été ajoutés au panier
                par l'employé, mais font partie de la vente — ils doivent rester visibles ici. */}
            {promoResult.lines.filter((l) => l.isGift).map((l) => (
              <li key={`gift-${l.productId}`} className="flex items-center justify-between text-sm gap-2 text-green-700">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Gift className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{l.quantity} × {l.productName}</span>
                  <Badge className="text-[10px] bg-green-100 text-green-700 flex-shrink-0">Offert</Badge>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-semibold">Gratuit</span>
                  {l.promotionId && (
                    <button
                      onClick={() => declineGift(l.promotionId as string)}
                      title="Refuser cet article offert"
                      className="text-green-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {promoOpportunities.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-1.5">
              {promoOpportunities.map(({ promo, buyProduct, missing }) => (
                <div key={promo.id} className="flex items-center justify-between gap-2 text-xs text-amber-800">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Gift className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">
                      Offre dispo : encore {missing} {buyProduct.name} pour « {promo.name} »
                    </span>
                  </span>
                  <button
                    onClick={() => addQuantityToCart(buyProduct, missing)}
                    className="flex-shrink-0 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-full px-2.5 py-1 transition-colors"
                  >
                    Ajouter
                  </button>
                </div>
              ))}
            </div>
          )}

          {promoResult.totalDiscount > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50/60 p-2.5">
              <div className="flex items-center gap-2 text-xs text-green-700">
                <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Remise appliquée : -{fmt(promoResult.totalDiscount)}</span>
              </div>
            </div>
          )}

          <div className="border-t border-red-200 pt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total</p>
              {promoResult.totalDiscount > 0 && (
                <p className="text-xs text-gray-400 line-through">{fmt(promoResult.subtotal)}</p>
              )}
              <p className="text-lg font-bold text-red-600">{fmt(cartTotal)}</p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Valider les ventes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
