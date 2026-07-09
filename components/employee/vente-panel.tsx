"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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

export function VentePanel({ period, gymId, gymName, userEmail, userName }: VentePanelProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<PromotionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [successCount, setSuccessCount] = useState(0)

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
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    )
  }, [products, search])

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [products])

  const grouped = useMemo(() => {
    const map: Record<string, Product[]> = {}
    filtered.forEach((p) => {
      const cat = p.category || "Autres"
      if (!map[cat]) map[cat] = []
      map[cat].push(p)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const promoResult = useMemo(
    () => applyPromotions(
      cart.map((item) => ({ product: item.product, quantity: item.quantity })),
      promotions,
      products,
      gymId || null
    ),
    [cart, promotions, products, gymId]
  )
  const cartTotal = promoResult.total
  const cartCount = cart.reduce((a, item) => a + item.quantity, 0)

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    )
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
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
        }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const count = Array.isArray(json?.data?.sales) ? json.data.sales.length : cart.length
      setCart([])
      setSuccessCount((c) => c + count)
      toast.success(`Vente enregistrée avec succès (${count} ligne(s))`)
      // Rafraîchir le stock
      const stockRes = await fetch(gymId ? `/api/products?gym_id=${gymId}` : "/api/products", { credentials: "same-origin" })
      const stockJson = stockRes.ok ? await stockRes.json() : { data: [] }
      setProducts(Array.isArray(stockJson.data) ? stockJson.data : [])
    } catch {
      toast.error("La vente n'a pas pu être enregistrée")
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

          {/* Catalogue */}
          {grouped.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucun article correspondant</p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((product) => {
                      const inCart = cart.find((i) => i.product.id === product.id)
                      const outOfStock = product.stock === 0
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
                              {!outOfStock && product.stock <= 5 && (
                                <Badge className="text-xs bg-amber-100 text-amber-700 flex-shrink-0">
                                  {product.stock} restant(s)
                                </Badge>
                              )}
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
                                disabled={outOfStock}
                                className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors disabled:opacity-40"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => !outOfStock && addToCart(product)}
                              disabled={outOfStock}
                              className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors disabled:opacity-40 flex-shrink-0"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
              onClick={() => setCart([])}
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
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-white">
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
          </ul>

          {promoResult.appliedPromotions.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50/60 p-2.5 space-y-1.5">
              {promoResult.lines.filter((l) => l.isGift).map((l) => (
                <div key={`gift-${l.productId}`} className="flex items-center gap-2 text-xs text-green-700">
                  <Gift className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{l.quantity} × {l.productName} offert{l.quantity > 1 ? "s" : ""}</span>
                </div>
              ))}
              {promoResult.totalDiscount > 0 && (
                <div className="flex items-center gap-2 text-xs text-green-700">
                  <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Remise appliquée : -{fmt(promoResult.totalDiscount)}</span>
                </div>
              )}
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
