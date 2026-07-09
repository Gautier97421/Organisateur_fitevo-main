"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ShoppingBag, Plus, Edit2, Trash2, TrendingUp, Package,
  Euro, AlertTriangle, CalendarDays, User, Building2, X, History, Gift,
} from "lucide-react"
import { toast } from "sonner"
import { PromotionsManager } from "@/components/admin/promotions-manager"

interface Product {
  id: string
  name: string
  description?: string | null
  price: number
  category?: string | null
  stock: number
  trackStock: boolean
  isActive: boolean
  gymId?: string | null
}

interface Sale {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
  userEmail: string
  userName: string
  gymId?: string | null
  period?: string | null
  saleDate: string
  saleMonth: string
  notes?: string | null
  isGift?: boolean
}

interface Gym {
  id: string
  name: string
}

type Tab = "articles" | "promotions" | "dashboard" | "historique"

const periodLabel: Record<string, string> = {
  matin: "Matin",
  aprem: "Après-midi",
  journee: "Journée",
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function VentesStockManager() {
  const [tab, setTab] = useState<Tab>("articles")

  // Articles
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    stock: "0",
    trackStock: true,
    gymId: "",
  })

  // Sales & Dashboard
  const [sales, setSales] = useState<Sale[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const [filterMonth, setFilterMonth] = useState(currentMonth())
  const [filterGym, setFilterGym] = useState("")
  const [gyms, setGyms] = useState<Gym[]>([])

  useEffect(() => {
    loadProducts()
    fetch("/api/db/gyms").then((r) => r.json()).then((j) => setGyms(Array.isArray(j.data) ? j.data : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === "dashboard" || tab === "historique") loadSales()
  }, [tab, filterMonth, filterGym])

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch("/api/products?include_inactive=true")
      const json = res.ok ? await res.json() : { data: [] }
      setProducts(Array.isArray(json.data) ? json.data : [])
    } finally {
      setLoadingProducts(false)
    }
  }

  const loadSales = async () => {
    setLoadingSales(true)
    try {
      const params = new URLSearchParams({ month: filterMonth })
      if (filterGym) params.set("gym_id", filterGym)
      const res = await fetch(`/api/sales?${params}`)
      const json = res.ok ? await res.json() : { data: [] }
      setSales(Array.isArray(json.data) ? json.data : [])
    } finally {
      setLoadingSales(false)
    }
  }

  const openAdd = () => {
    setEditingProduct(null)
    setForm({ name: "", description: "", price: "", category: "", stock: "0", trackStock: true, gymId: "" })
    setShowDialog(true)
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      category: p.category || "",
      stock: String(p.stock),
      trackStock: p.trackStock,
      gymId: p.gymId || "",
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      toast.error("Nom et prix sont obligatoires")
      return
    }
    const price = Number(form.price)
    if (isNaN(price) || price < 0) {
      toast.error("Prix invalide")
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      category: form.category.trim() || null,
      stock: form.trackStock ? (Number(form.stock) || 0) : 0,
      trackStock: form.trackStock,
      gymId: form.gymId || null,
    }

    try {
      if (editingProduct) {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        toast.success("Article mis à jour")
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        toast.success("Article créé")
      }
      setShowDialog(false)
      loadProducts()
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  const handleToggleActive = async (p: Product) => {
    try {
      await fetch(`/api/products/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !p.isActive }),
      })
      loadProducts()
    } catch {
      toast.error("Erreur")
    }
  }

  const handleDelete = async () => {
    if (!productToDelete) return
    try {
      await fetch(`/api/products/${productToDelete}`, { method: "DELETE" })
      toast.success("Article archivé")
      loadProducts()
    } finally {
      setShowDeleteConfirm(false)
      setProductToDelete(null)
    }
  }

  // Dashboard stats
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0]
    const todaySales = sales.filter((s) => s.saleDate.startsWith(todayStr))
    const totalDay = todaySales.reduce((a, s) => a + s.total, 0)
    const totalMonth = sales.reduce((a, s) => a + s.total, 0)
    const countDay = todaySales.reduce((a, s) => a + s.quantity, 0)
    const countMonth = sales.reduce((a, s) => a + s.quantity, 0)

    // Top produits du mois
    const byProduct: Record<string, { name: string; qty: number; total: number }> = {}
    sales.forEach((s) => {
      if (!byProduct[s.productId]) byProduct[s.productId] = { name: s.productName, qty: 0, total: 0 }
      byProduct[s.productId].qty += s.quantity
      byProduct[s.productId].total += s.total
    })
    const topProducts = Object.values(byProduct).sort((a, b) => b.total - a.total).slice(0, 5)

    // Alertes stock
    const lowStock = products.filter((p) => p.isActive && p.trackStock && p.stock <= 5)

    return { totalDay, totalMonth, countDay, countMonth, topProducts, lowStock }
  }, [sales, products])

  const activeProducts = products.filter((p) => p.isActive)
  const inactiveProducts = products.filter((p) => !p.isActive)

  const categoryOptions = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [products])

  // Mois dispo (6 derniers)
  const monthOptions = useMemo(() => {
    const months: string[] = []
    const d = new Date()
    for (let i = 0; i < 6; i++) {
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
      d.setMonth(d.getMonth() - 1)
    }
    return months
  }, [])

  const gymById = useMemo(() => new Map(gyms.map((g) => [g.id, g.name])), [gyms])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShoppingBag className="w-6 h-6 text-red-600 flex-shrink-0" />
          <h2 className="text-2xl font-bold text-gray-900">Ventes & Stock</h2>
        </div>
        {tab === "articles" && (
          <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Ajouter un article
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["articles", "promotions", "dashboard", "historique"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = { articles: "Articles", promotions: "Promotions", dashboard: "Tableau de bord", historique: "Historique" }
          const icons: Record<Tab, React.ReactNode> = {
            articles: <Package className="w-4 h-4" />,
            promotions: <Gift className="w-4 h-4" />,
            dashboard: <TrendingUp className="w-4 h-4" />,
            historique: <History className="w-4 h-4" />,
          }
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                t === tab
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {icons[t]} {labels[t]}
            </button>
          )
        })}
      </div>

      {/* ── ONGLET ARTICLES ── */}
      {tab === "articles" && (
        <div className="space-y-4">
          {loadingProducts ? (
            <p className="text-gray-500 text-sm">Chargement…</p>
          ) : activeProducts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>Aucun article. Cliquez sur "Ajouter un article" pour commencer.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {activeProducts.map((p) => (
                <Card key={p.id} className="border">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{p.name}</h3>
                        {p.category && <Badge variant="outline" className="text-xs">{p.category}</Badge>}
                        {p.gymId && (
                          <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">
                            {gymById.get(p.gymId) || p.gymId}
                          </Badge>
                        )}
                        {p.trackStock && p.stock <= 5 && (
                          <Badge className="text-xs bg-amber-100 text-amber-700">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Stock faible ({p.stock})
                          </Badge>
                        )}
                      </div>
                      {p.description && <p className="text-xs text-gray-500 mt-1 truncate">{p.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="font-bold text-red-600">{fmt(p.price)}</span>
                        {p.trackStock ? (
                          <span className="text-gray-500">Stock : <strong className="text-gray-700">{p.stock}</strong></span>
                        ) : (
                          <span className="text-gray-400 text-xs">Sans stock</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        onClick={() => handleToggleActive(p)}
                        variant="outline"
                        size="sm"
                        className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-900"
                      >
                        Désactiver
                      </Button>
                      <Button onClick={() => openEdit(p)} variant="outline" size="sm">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => { setProductToDelete(p.id); setShowDeleteConfirm(true) }}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {inactiveProducts.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                {inactiveProducts.length} article(s) archivé(s)
              </summary>
              <div className="grid gap-2 mt-2">
                {inactiveProducts.map((p) => (
                  <Card key={p.id} className="border border-gray-100 opacity-60">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-sm text-gray-500 line-through">{p.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{fmt(p.price)}</span>
                      </div>
                      <Button
                        onClick={() => handleToggleActive(p)}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Restaurer
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── ONGLET PROMOTIONS ── */}
      {tab === "promotions" && <PromotionsManager />}

      {/* ── ONGLET TABLEAU DE BORD ── */}
      {tab === "dashboard" && (
        <div className="space-y-5">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => {
                  const [y, mo] = m.split("-")
                  const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
                  return <SelectItem key={m} value={m}>{label}</SelectItem>
                })}
              </SelectContent>
            </Select>
            <Select value={filterGym || "_all"} onValueChange={(v) => setFilterGym(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes les salles</SelectItem>
                {gyms.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">CA aujourd'hui</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{fmt(stats.totalDay)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stats.countDay} article(s) vendu(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">CA du mois</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{fmt(stats.totalMonth)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stats.countMonth} article(s) vendu(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Articles actifs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{activeProducts.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">{products.length} au total</p>
              </CardContent>
            </Card>
            <Card className={stats.lowStock.length > 0 ? "border-amber-300" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  {stats.lowStock.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  Stock faible
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${stats.lowStock.length > 0 ? "text-amber-600" : "text-gray-900"}`}>
                  {stats.lowStock.length}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">article(s) ≤ 5 unités</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top produits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-500" /> Top articles du mois
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSales ? (
                  <p className="text-sm text-gray-400">Chargement…</p>
                ) : stats.topProducts.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune vente ce mois</p>
                ) : (
                  <ol className="space-y-2">
                    {stats.topProducts.map((p, i) => (
                      <li key={p.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-red-50 text-red-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-gray-800 truncate max-w-[160px]">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-right flex-shrink-0">
                          <span className="text-gray-500 text-xs">{p.qty} vente(s)</span>
                          <span className="font-semibold text-gray-900">{fmt(p.total)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            {/* Alertes stock */}
            <Card className={stats.lowStock.length > 0 ? "border-amber-200" : ""}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertes stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.lowStock.length === 0 ? (
                  <p className="text-sm text-gray-400">Tous les stocks sont suffisants.</p>
                ) : (
                  <ul className="space-y-2">
                    {stats.lowStock.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800 truncate max-w-[180px]">{p.name}</span>
                        <Badge className={`text-xs ${p.stock === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {p.stock === 0 ? "Rupture" : `${p.stock} restant(s)`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── ONGLET HISTORIQUE ── */}
      {tab === "historique" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => {
                  const [y, mo] = m.split("-")
                  const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
                  return <SelectItem key={m} value={m}>{label}</SelectItem>
                })}
              </SelectContent>
            </Select>
            <Select value={filterGym || "_all"} onValueChange={(v) => setFilterGym(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes les salles</SelectItem>
                {gyms.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loadingSales ? (
            <p className="text-sm text-gray-400">Chargement…</p>
          ) : sales.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <History className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p>Aucune vente sur cette période.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employé</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Article</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Qté</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">P.U.</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Salle</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Période</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                          {new Date(s.saleDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          <span className="text-gray-400 text-xs">
                            {new Date(s.saleDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-800 truncate max-w-[140px]">{s.userName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {s.productName}
                        {s.isGift && <Badge className="ml-2 text-xs bg-green-100 text-green-700">🎁 Offert</Badge>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{s.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(s.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(s.total)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.gymId ? (
                          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{gymById.get(s.gymId) || "—"}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {s.period ? <Badge variant="outline" className="text-xs">{periodLabel[s.period] ?? s.period}</Badge> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-medium text-gray-600">
                      Total ({sales.length} vente(s))
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {fmt(sales.reduce((a, s) => a + s.total, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dialog Ajouter / Modifier article */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Modifier l'article" : "Ajouter un article"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label className="text-sm font-medium">Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex : Barre protéinée"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optionnel"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Prix (€) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              {form.trackStock && (
                <div>
                  <Label className="text-sm font-medium">Stock</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="track-stock-toggle"
                type="checkbox"
                checked={form.trackStock}
                onChange={(e) => setForm((f) => ({ ...f, trackStock: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="track-stock-toggle" className="text-sm text-gray-700">
                Suivre le stock
              </label>
              {!form.trackStock && (
                <span className="text-xs text-gray-400">(ex : formule séance, prestation sans stock)</span>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium">Catégorie</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="ex : Nutrition, Équipement…"
                className="mt-1"
                list="product-category-options"
              />
              <datalist id="product-category-options">
                {categoryOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label className="text-sm font-medium">Salle (laisser vide = toutes)</Label>
              <Select value={form.gymId || "_all"} onValueChange={(v) => setForm((f) => ({ ...f, gymId: v === "_all" ? "" : v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Toutes les salles</SelectItem>
                  {gyms.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white">
              {editingProduct ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertTriangle className="h-5 w-5 text-red-600" /> Archiver l'article
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">L'article sera masqué des ventes mais son historique sera conservé.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setProductToDelete(null) }}>
              <X className="mr-2 h-4 w-4" /> Annuler
            </Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              <Trash2 className="mr-2 h-4 w-4" /> Archiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
