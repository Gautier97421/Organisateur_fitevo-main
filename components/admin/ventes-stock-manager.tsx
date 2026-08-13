"use client"

import { Fragment, useState, useEffect, useMemo } from "react"
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
  Euro, AlertTriangle, CalendarDays, User, Building2, X, History, Gift, Download,
  ChevronDown, ChevronRight, BarChart3, PieChart as PieChartIcon,
} from "lucide-react"
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
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
  /** null quand l'article a été supprimé du catalogue — la vente, elle, reste. */
  productId: string | null
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

/**
 * Clé de regroupement d'une vente par article, pour les stats et les graphes.
 *
 * L'article supprimé du catalogue n'a plus d'id sur ses ventes : on retombe alors sur
 * le nom figé sur la vente, sinon toutes les ventes d'articles supprimés fusionneraient
 * dans un même bloc.
 */
function saleProductKey(sale: Sale): string {
  return sale.productId ?? `name:${sale.productName}`
}

/** Format court ("août 26"), pour l'axe du graphe où 6 libellés doivent tenir. */
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-")
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
}

/** Format long ("août 2026"), pour les titres. */
function monthLabelLong(month: string): string {
  const [year, monthNumber] = month.split("-")
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

/** Les `count` derniers mois jusqu'à `month` inclus, du plus ancien au plus récent. */
function recentMonths(month: string, count: number): string[] {
  const [year, monthNumber] = month.split("-")
  const endDate = new Date(Number(year), Number(monthNumber) - 1, 1)
  const months: string[] = []

  for (let index = count - 1; index >= 0; index--) {
    const date = new Date(endDate)
    date.setMonth(endDate.getMonth() - index)
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`)
  }

  return months
}

const MONTHS_TO_COMPARE = 6

/** Nombre d'articles détaillés dans les graphes ; le reste est cumulé dans « Autres ». */
const TOP_ARTICLES = 8

const OTHERS_KEY = "others"
const OTHERS_LABEL = "Autres"

const chartColors = [
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#0891b2",
  "#7c3aed",
  "#db2777",
  "#4f46e5",
]

export function VentesStockManager() {
  const [tab, setTab] = useState<Tab>("articles")

  // Articles
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [filterArticleCategory, setFilterArticleCategory] = useState("")
  const [filterArticleGym, setFilterArticleGym] = useState("")
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
  const [salesByMonth, setSalesByMonth] = useState<Record<string, Sale[]>>({})
  const [loadingSales, setLoadingSales] = useState(false)
  const [filterMonth, setFilterMonth] = useState(currentMonth())
  const [filterGym, setFilterGym] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [gyms, setGyms] = useState<Gym[]>([])
  // Mesure des graphes du tableau de bord. Le CA seul masque les articles offerts
  // (total à 0 €) alors qu'ils ont bien été vendus : la vue quantité les révèle.
  const [chartMetric, setChartMetric] = useState<"total" | "quantity">("total")

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
      const salesForMonth = async (month: string): Promise<Sale[]> => {
        const params = new URLSearchParams({ month })
        if (filterGym) params.set("gym_id", filterGym)
        const res = await fetch(`/api/sales?${params}`)
        const json = res.ok ? await res.json() : { data: [] }
        return Array.isArray(json.data) ? json.data : []
      }

      // Les mois antérieurs n'alimentent que la comparaison du tableau de bord :
      // inutile de les charger pour l'onglet Historique.
      const months =
        tab === "dashboard" ? recentMonths(filterMonth, MONTHS_TO_COMPARE) : [filterMonth]
      const results = await Promise.all(months.map(salesForMonth))

      const byMonth: Record<string, Sale[]> = {}
      months.forEach((month, index) => {
        byMonth[month] = results[index]
      })

      setSalesByMonth(byMonth)
      setSales(byMonth[filterMonth] ?? [])
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
      const res = await fetch(`/api/products/${productToDelete}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Article supprimé")
      loadProducts()
      loadSales()
    } catch {
      toast.error("Erreur lors de la suppression")
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
      const key = saleProductKey(s)
      if (!byProduct[key]) byProduct[key] = { name: s.productName, qty: 0, total: 0 }
      byProduct[key].qty += s.quantity
      byProduct[key].total += s.total
    })
    const topProducts = Object.values(byProduct).sort((a, b) => b.total - a.total).slice(0, 5)

    // Alertes stock
    const lowStock = products.filter((p) => p.isActive && p.trackStock && p.stock <= 5)

    return { totalDay, totalMonth, countDay, countMonth, topProducts, lowStock }
  }, [sales, products])

  const categoryOptions = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterArticleCategory && p.category !== filterArticleCategory) return false
      if (filterArticleGym && p.gymId !== filterArticleGym) return false
      return true
    })
  }, [products, filterArticleCategory, filterArticleGym])

  const activeProducts = filteredProducts.filter((p) => p.isActive)
  const inactiveProducts = filteredProducts.filter((p) => !p.isActive)

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

  // ── Comparaison multi-mois et répartition, par article ──
  const monthsToCompare = useMemo(
    () => recentMonths(filterMonth, MONTHS_TO_COMPARE),
    [filterMonth],
  )

  /**
   * Une série par article, classée sur la mesure affichée (CA ou quantité) sur toute
   * la fenêtre de comparaison. Au-delà de `TOP_ARTICLES`, les articles restants sont
   * cumulés dans « Autres » : un catalogue de plusieurs dizaines de références
   * rendrait sinon l'histogramme et le camembert illisibles.
   *
   * Le classement retient tout article ayant au moins une vente, y compris à 0 € :
   * un article offert a un CA nul mais une quantité non nulle, et disparaîtrait
   * sinon complètement des deux graphes.
   *
   * Ce classement unique sert aux deux graphes, pour qu'un article y garde la même
   * couleur et que « Autres » y recouvre exactement le même ensemble.
   *
   * Les clés du jeu de données sont synthétiques (`art0`, `art1`…) car Recharts
   * résout `dataKey` comme un chemin : un nom d'article contenant un point serait
   * interprété comme un accès imbriqué.
   */
  const articleSeries = useMemo(() => {
    const totals = new Map<string, { label: string; total: number; quantity: number }>()

    for (const month of monthsToCompare) {
      for (const sale of salesByMonth[month] ?? []) {
        const productKey = saleProductKey(sale)
        const current = totals.get(productKey)
        if (current) {
          current.total += sale.total
          current.quantity += sale.quantity
        } else {
          // Le nom est celui figé sur la vente : un article renommé garde son
          // libellé d'origine sur l'historique déjà enregistré.
          totals.set(productKey, {
            label: sale.productName,
            total: sale.total,
            quantity: sale.quantity,
          })
        }
      }
    }

    // À CA égal (deux articles offerts, par exemple), la quantité départage.
    const ranked = Array.from(totals.entries()).sort((a, b) => {
      const primary = b[1][chartMetric] - a[1][chartMetric]
      if (primary !== 0) return primary
      return b[1].quantity - a[1].quantity
    })

    const series = ranked
      .slice(0, TOP_ARTICLES)
      .map(([productKey, entry], index) => ({ key: `art${index}`, productKey, label: entry.label }))

    if (ranked.length > TOP_ARTICLES) {
      series.push({ key: OTHERS_KEY, productKey: OTHERS_KEY, label: OTHERS_LABEL })
    }

    return series
  }, [salesByMonth, monthsToCompare, chartMetric])

  /** clé article → clé de série, « Autres » servant de repli quand la série existe. */
  const seriesKeyByProductKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const serie of articleSeries) {
      if (serie.productKey !== OTHERS_KEY) map.set(serie.productKey, serie.key)
    }
    return map
  }, [articleSeries])

  const hasOthersSeries = useMemo(
    () => articleSeries.some((s) => s.key === OTHERS_KEY),
    [articleSeries],
  )

  const monthlyComparisonData = useMemo(() => {
    return monthsToCompare.map((month) => {
      const row: Record<string, any> = { month, monthLabel: monthLabel(month) }
      for (const serie of articleSeries) row[serie.key] = 0

      for (const sale of salesByMonth[month] ?? []) {
        const key = seriesKeyByProductKey.get(saleProductKey(sale)) ?? (hasOthersSeries ? OTHERS_KEY : null)
        if (key) row[key] += sale[chartMetric]
      }

      for (const serie of articleSeries) {
        row[serie.key] = Number(row[serie.key].toFixed(2))
      }
      return row
    })
  }, [salesByMonth, monthsToCompare, articleSeries, seriesKeyByProductKey, hasOthersSeries, chartMetric])

  // On garde toute série présente dans le classement : un article offert affiche une
  // barre nulle en vue CA, mais reste dans la légende et réapparaît en vue quantité.
  const seriesWithData = articleSeries

  /** Couleur par article, indexée sur le classement stable de `articleSeries`. */
  const colorBySeriesKey = useMemo(() => {
    const map = new Map<string, string>()
    articleSeries.forEach((serie, index) => {
      map.set(serie.key, chartColors[index % chartColors.length])
    })
    return map
  }, [articleSeries])

  /**
   * Répartition du mois sélectionné, par article. `value` porte la mesure affichée
   * (elle alimente le camembert), `total` et `quantity` sont conservés pour que la
   * légende détaille toujours les deux — un article offert y apparaît ainsi avec
   * sa quantité et un CA à 0 €, au lieu d'être invisible.
   */
  const articleBreakdown = useMemo(() => {
    const totals = new Map<string, { total: number; quantity: number }>()

    for (const sale of sales) {
      const key = seriesKeyByProductKey.get(saleProductKey(sale)) ?? (hasOthersSeries ? OTHERS_KEY : null)
      if (!key) continue
      const current = totals.get(key) ?? { total: 0, quantity: 0 }
      current.total += sale.total
      current.quantity += sale.quantity
      totals.set(key, current)
    }

    return articleSeries
      .map((serie) => {
        const entry = totals.get(serie.key) ?? { total: 0, quantity: 0 }
        return {
          key: serie.key,
          label: serie.label,
          total: Number(entry.total.toFixed(2)),
          quantity: entry.quantity,
          value: chartMetric === "total" ? Number(entry.total.toFixed(2)) : entry.quantity,
        }
      })
      .filter((item) => item.quantity > 0)
      .sort((a, b) => b.value - a.value || b.quantity - a.quantity)
  }, [sales, articleSeries, seriesKeyByProductKey, hasOthersSeries, chartMetric])

  const articleBreakdownTotal = useMemo(
    () => articleBreakdown.reduce((sum, item) => sum + item.value, 0),
    [articleBreakdown],
  )

  /** Formate une valeur selon la mesure affichée : montant en euros ou nombre d'unités. */
  const formatMetric = (value: number) =>
    chartMetric === "total" ? fmt(value) : `${value} unité${value > 1 ? "s" : ""}`

  // Regroupe les lignes d'une même vente (un panier validé peut produire plusieurs lignes, une par
  // article) : toutes les lignes créées par un même checkout partagent exactement le même horodatage.
  const saleGroups = useMemo(() => {
    const map = new Map<string, { key: string; saleDate: string; userEmail: string; userName: string; gymId?: string | null; period?: string | null; items: Sale[]; total: number; itemCount: number }>()
    for (const s of sales) {
      const key = `${s.saleDate}|${s.userEmail}|${s.gymId || ""}|${s.period || ""}`
      let group = map.get(key)
      if (!group) {
        group = { key, saleDate: s.saleDate, userEmail: s.userEmail, userName: s.userName, gymId: s.gymId, period: s.period, items: [], total: 0, itemCount: 0 }
        map.set(key, group)
      }
      group.items.push(s)
      group.total += s.total
      group.itemCount += s.quantity
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
  }, [sales])

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportSalesPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ])

    const [y, mo] = filterMonth.split("-")
    const monthLabel = new Date(Number(y), Number(mo) - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    const gymName = filterGym ? (gymById.get(filterGym) || filterGym) : "Toutes les salles"

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()

    // Bandeau titre rouge
    doc.setFillColor(220, 38, 38)
    doc.rect(0, 0, pageW, 18, "F")
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(255, 255, 255)
    doc.text(`Ventes — ${monthLabel}`, 14, 12)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(
      `Exporté le ${new Date().toLocaleDateString("fr-FR")}  ·  ${gymName}  ·  ${saleGroups.length} vente(s)`,
      pageW - 14,
      12,
      { align: "right" },
    )

    // Résumé
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text("Résumé", 14, 26)

    const totalAmount = sales.reduce((a, s) => a + s.total, 0)
    const totalArticles = sales.reduce((a, s) => a + s.quantity, 0)
    autoTable(doc, {
      startY: 29,
      head: [["Total des ventes", "Nombre de ventes", "Nombre d'articles"]],
      body: [[fmt(totalAmount), String(saleGroups.length), String(totalArticles)]],
      theme: "grid",
      headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 9, fontStyle: "bold", halign: "center" },
      margin: { left: 14, right: 14 },
    })

    const afterSummary = (doc as any).lastAutoTable?.finalY ?? 40
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text("Détail des ventes", 14, afterSummary + 8)

    // Une "vente" (transaction) = une ligne d'en-tête (fond rouge clair, fusionnée sur toutes les
    // colonnes) suivie des articles qui la composent, pour rester lisible même avec beaucoup de ventes.
    const columns = ["Article", "Qté", "P.U.", "Total"]
    const rows: any[] = []
    for (const g of saleGroups) {
      const dateLabel = new Date(g.saleDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
      const timeLabel = new Date(g.saleDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      const gymLabel = g.gymId ? (gymById.get(g.gymId) || "—") : "Toutes"
      const periodLabelText = g.period ? (periodLabel[g.period] ?? g.period) : "—"
      rows.push([
        {
          content: `${dateLabel} ${timeLabel}  ·  ${g.userName}  ·  ${gymLabel}  ·  ${periodLabelText}  ·  Total ${fmt(g.total)}`,
          colSpan: columns.length,
          styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: "bold", fontSize: 7.5, halign: "left" },
        },
      ])
      for (const s of g.items) {
        rows.push([
          s.productName + (s.isGift ? " (offert)" : ""),
          String(s.quantity),
          fmt(s.unitPrice),
          fmt(s.total),
        ])
      }
    }

    autoTable(doc, {
      startY: afterSummary + 11,
      head: [columns],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold", fontSize: 7 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "center", cellWidth: 16 }, 2: { halign: "right", cellWidth: 22 }, 3: { halign: "right", cellWidth: 22 } },
      margin: { left: 14, right: 14 },
    })

    doc.save(`ventes-${filterMonth}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShoppingBag className="w-6 h-6 text-red-600 flex-shrink-0" />
          <h2 className="text-2xl font-bold text-gray-900 truncate">Ventes & Stock</h2>
        </div>
        {tab === "articles" && (
          <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Ajouter un article
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
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
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex-shrink-0",
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
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterArticleCategory || "_all"} onValueChange={(v) => setFilterArticleCategory(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes les catégories</SelectItem>
                {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterArticleGym || "_all"} onValueChange={(v) => setFilterArticleGym(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Toutes les salles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes les salles</SelectItem>
                {gyms.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterArticleCategory || filterArticleGym) && (
              <button
                onClick={() => { setFilterArticleCategory(""); setFilterArticleGym("") }}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors self-center"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {loadingProducts ? (
            <p className="text-gray-500 text-sm">Chargement…</p>
          ) : activeProducts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>{filterArticleCategory || filterArticleGym ? "Aucun article ne correspond à ces filtres." : "Aucun article. Cliquez sur \"Ajouter un article\" pour commencer."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {activeProducts.map((p) => (
                <Card key={p.id} className="border overflow-hidden">
                  <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 break-words min-w-0">{p.name}</h3>
                        {p.category && <Badge variant="outline" className="text-xs max-w-full truncate">{p.category}</Badge>}
                        {p.gymId && (
                          <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 max-w-full truncate">
                            {gymById.get(p.gymId) || p.gymId}
                          </Badge>
                        )}
                        {p.trackStock && p.stock <= 5 && (
                          <Badge className="text-xs bg-amber-100 text-amber-700 whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 mr-1 flex-shrink-0" />
                            Stock faible ({p.stock})
                          </Badge>
                        )}
                      </div>
                      {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">{p.description}</p>}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                        <span className="font-bold text-red-600">{fmt(p.price)}</span>
                        {p.trackStock ? (
                          <span className="text-gray-500">Stock : <strong className="text-gray-700">{p.stock}</strong></span>
                        ) : (
                          <span className="text-gray-400 text-xs">Sans stock</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                      <Button
                        onClick={() => handleToggleActive(p)}
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-900"
                      >
                        Désactiver
                      </Button>
                      <Button onClick={() => openEdit(p)} variant="outline" size="sm" className="flex-shrink-0">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => { setProductToDelete(p.id); setShowDeleteConfirm(true) }}
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 text-red-600 hover:bg-red-50"
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
                {inactiveProducts.length} article(s) désactivé(s)
              </summary>
              <div className="grid gap-2 mt-2">
                {inactiveProducts.map((p) => (
                  <Card key={p.id} className="border border-gray-100 opacity-60">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate">
                        <span className="text-sm text-gray-500 line-through">{p.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{fmt(p.price)}</span>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          onClick={() => handleToggleActive(p)}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          Réactiver
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
              <SelectTrigger className="w-full sm:w-44">
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
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes les salles</SelectItem>
                {gyms.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Mesure appliquée aux deux graphes ci-dessous */}
            <div className="flex w-full sm:w-auto rounded-xl border border-gray-200 overflow-hidden">
              {([
                { value: "total" as const, label: "Chiffre d'affaires" },
                { value: "quantity" as const, label: "Quantité" },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setChartMetric(option.value)}
                  className={[
                    "flex-1 sm:flex-none px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    chartMetric === option.value
                      ? "bg-red-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="min-w-0">
              <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">CA aujourd'hui</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <p className="text-xl sm:text-2xl font-bold text-red-600 break-words">{fmt(stats.totalDay)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stats.countDay} article(s) vendu(s)</p>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">CA du mois</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{fmt(stats.totalMonth)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stats.countMonth} article(s) vendu(s)</p>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Articles actifs</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{activeProducts.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">{products.length} au total</p>
              </CardContent>
            </Card>
            <Card className={`min-w-0 ${stats.lowStock.length > 0 ? "border-amber-300" : ""}`}>
              <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  {stats.lowStock.length > 0 && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />}
                  Stock faible
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <p className={`text-xl sm:text-2xl font-bold ${stats.lowStock.length > 0 ? "text-amber-600" : "text-gray-900"}`}>
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

          {/* Comparaison multi-mois */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4 text-red-600 flex-shrink-0" />
                Comparaison multi-mois par article ({monthsToCompare.length} mois) —{" "}
                {chartMetric === "total" ? "chiffre d'affaires" : "quantités vendues"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSales ? (
                <p className="text-sm text-gray-400">Chargement…</p>
              ) : seriesWithData.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Aucune vente sur les {monthsToCompare.length} derniers mois.
                </p>
              ) : (
                <div className="h-[300px] sm:h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={monthlyComparisonData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: any) => formatMetric(Number(value))} />
                      <Legend />
                      {seriesWithData.map((serie) => (
                        <Bar
                          key={serie.key}
                          dataKey={serie.key}
                          name={serie.label}
                          fill={colorBySeriesKey.get(serie.key) ?? chartColors[0]}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Répartition du mois par article */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChartIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
                Répartition par article ({monthLabelLong(filterMonth)}) —{" "}
                {chartMetric === "total" ? "chiffre d'affaires" : "quantités vendues"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSales ? (
                <p className="text-sm text-gray-400">Chargement…</p>
              ) : articleBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune vente ce mois-ci.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div className="h-[280px] sm:h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={articleBreakdown}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius="80%"
                          label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                        >
                          {articleBreakdown.map((item) => (
                            <Cell key={item.key} fill={colorBySeriesKey.get(item.key) ?? chartColors[0]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => formatMetric(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    {articleBreakdown.map((item) => {
                      const share = articleBreakdownTotal > 0 ? (item.value / articleBreakdownTotal) * 100 : 0
                      return (
                        <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: colorBySeriesKey.get(item.key) ?? chartColors[0] }}
                            />
                            <span className="font-medium text-gray-900 truncate">{item.label}</span>
                          </div>
                          {/* Les deux mesures sont toujours détaillées : un article
                              offert affiche 0 € mais garde sa quantité visible. */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-gray-900">
                              {item.quantity} vendu{item.quantity > 1 ? "s" : ""} · {fmt(item.total)}
                            </p>
                            <p className="text-xs text-gray-500">{share.toFixed(1)}% des {chartMetric === "total" ? "ventes" : "unités"}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ONGLET HISTORIQUE ── */}
      {tab === "historique" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full sm:w-44">
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
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes les salles</SelectItem>
                {gyms.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              onClick={exportSalesPDF}
              disabled={sales.length === 0}
              variant="outline"
              className="w-full sm:w-auto sm:ml-auto border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-900 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Télécharger PDF
            </Button>
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
                    <th className="w-8 px-2 py-3" />
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employé</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Articles</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Salle</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Période</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {saleGroups.map((g) => {
                    const expanded = expandedGroups.has(g.key)
                    return (
                      <Fragment key={g.key}>
                        <tr
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleGroup(g.key)}
                        >
                          <td className="px-2 py-3 text-gray-400">
                            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(g.saleDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                              <span className="text-gray-400 text-xs">
                                {new Date(g.saleDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-gray-800 truncate max-w-[140px]">{g.userName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">{g.itemCount}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(g.total)}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {g.gymId ? (
                              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{gymById.get(g.gymId) || "—"}</span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {g.period ? <Badge variant="outline" className="text-xs">{periodLabel[g.period] ?? g.period}</Badge> : "—"}
                          </td>
                        </tr>
                        {expanded && g.items.map((s) => (
                          <tr key={s.id} className="bg-gray-50/70 text-xs">
                            <td />
                            <td className="px-4 py-2 text-gray-400" colSpan={2}>{s.productName}</td>
                            <td className="px-4 py-2 text-center text-gray-600">
                              {s.quantity}
                              {s.isGift && <Badge className="ml-1.5 text-[10px] bg-green-100 text-green-700">🎁 Offert</Badge>}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-600">
                              {fmt(s.total)} <span className="text-gray-400">({fmt(s.unitPrice)}/u)</span>
                            </td>
                            <td colSpan={2} />
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-600">
                      Total {saleGroups.length} vente(s) · {sales.reduce((a, s) => a + s.quantity, 0)} article(s)
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
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" /> Supprimer l'article
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Cet article sera définitivement supprimé du catalogue, ainsi que les promotions qui le concernent.
            Les ventes déjà enregistrées restent dans l'historique et le chiffre d'affaires.
            Pour le retirer temporairement, utilisez plutôt « Désactiver ».
          </p>
          <DialogFooter className="gap-2 sm:flex-wrap sm:justify-center">
            <Button
              variant="outline"
              onClick={() => { setShowDeleteConfirm(false); setProductToDelete(null) }}
              className="whitespace-nowrap"
            >
              <X className="mr-2 h-4 w-4 flex-shrink-0" /> Annuler
            </Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap">
              <Trash2 className="mr-2 h-4 w-4 flex-shrink-0" /> Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
