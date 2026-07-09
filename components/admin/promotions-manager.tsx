"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
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
import { Gift, Percent, Plus, Edit2, Trash2, X, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { describePromotion, type PromotionRule } from "@/lib/promotions"

interface Product {
  id: string
  name: string
  category?: string | null
  isActive: boolean
}

interface Gym {
  id: string
  name: string
}

type PromoType = "buy_x_get_y" | "percentage"
type TargetScope = "product" | "category" | "all"

export function PromotionsManager() {
  const [promotions, setPromotions] = useState<PromotionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])

  const [showDialog, setShowDialog] = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromotionRule | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [promoToDelete, setPromoToDelete] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    type: "buy_x_get_y" as PromoType,
    gymId: "",
    buyProductId: "",
    buyQuantity: "1",
    getProductId: "",
    getQuantity: "1",
    percentage: "10",
    targetScope: "all" as TargetScope,
    targetProductId: "",
    targetCategory: "",
  })

  useEffect(() => {
    load()
    fetch("/api/products?include_inactive=true").then((r) => r.json()).then((j) => setProducts(Array.isArray(j.data) ? j.data : [])).catch(() => {})
    fetch("/api/db/gyms").then((r) => r.json()).then((j) => setGyms(Array.isArray(j.data) ? j.data : [])).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/promotions?include_inactive=true")
      const json = res.ok ? await res.json() : { data: [] }
      setPromotions(Array.isArray(json.data) ? json.data : [])
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [products])

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products])
  const gymById = useMemo(() => new Map(gyms.map((g) => [g.id, g.name])), [gyms])

  const resetForm = () => setForm({
    name: "",
    type: "buy_x_get_y",
    gymId: "",
    buyProductId: "",
    buyQuantity: "1",
    getProductId: "",
    getQuantity: "1",
    percentage: "10",
    targetScope: "all",
    targetProductId: "",
    targetCategory: "",
  })

  const openAdd = () => {
    setEditingPromo(null)
    resetForm()
    setShowDialog(true)
  }

  const openEdit = (promo: PromotionRule) => {
    setEditingPromo(promo)
    setForm({
      name: promo.name,
      type: promo.type,
      gymId: promo.gymId || "",
      buyProductId: promo.buyProductId || "",
      buyQuantity: String(promo.buyQuantity ?? 1),
      getProductId: promo.getProductId || "",
      getQuantity: String(promo.getQuantity ?? 1),
      percentage: String(promo.percentage ?? 10),
      targetScope: promo.targetProductId ? "product" : promo.targetCategory ? "category" : "all",
      targetProductId: promo.targetProductId || "",
      targetCategory: promo.targetCategory || "",
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom de la promotion est obligatoire")
      return
    }
    if (form.type === "buy_x_get_y" && !form.buyProductId) {
      toast.error("Sélectionnez le produit à acheter")
      return
    }
    if (form.type === "percentage" && form.targetScope === "product" && !form.targetProductId) {
      toast.error("Sélectionnez le produit ciblé")
      return
    }
    if (form.type === "percentage" && form.targetScope === "category" && !form.targetCategory) {
      toast.error("Sélectionnez la catégorie ciblée")
      return
    }

    const payload: any = {
      name: form.name.trim(),
      type: form.type,
      gymId: form.gymId || null,
    }
    if (form.type === "buy_x_get_y") {
      payload.buyProductId = form.buyProductId
      payload.buyQuantity = Number(form.buyQuantity) || 1
      payload.getProductId = form.getProductId || form.buyProductId
      payload.getQuantity = Number(form.getQuantity) || 1
    } else {
      payload.percentage = Number(form.percentage) || 0
      payload.targetProductId = form.targetScope === "product" ? form.targetProductId : null
      payload.targetCategory = form.targetScope === "category" ? form.targetCategory : null
    }

    try {
      if (editingPromo) {
        const res = await fetch(`/api/promotions/${editingPromo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        toast.success("Promotion mise à jour")
      } else {
        const res = await fetch("/api/promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        toast.success("Promotion créée")
      }
      setShowDialog(false)
      load()
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  const handleToggleActive = async (promo: PromotionRule) => {
    try {
      await fetch(`/api/promotions/${promo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !promo.isActive }),
      })
      load()
    } catch {
      toast.error("Erreur")
    }
  }

  const handleDelete = async () => {
    if (!promoToDelete) return
    try {
      await fetch(`/api/promotions/${promoToDelete}`, { method: "DELETE" })
      toast.success("Promotion désactivée")
      load()
    } finally {
      setShowDeleteConfirm(false)
      setPromoToDelete(null)
    }
  }

  const activePromos = promotions.filter((p) => p.isActive)
  const inactivePromos = promotions.filter((p) => !p.isActive)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="h-4 w-4 mr-2" /> Créer une promotion
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Chargement…</p>
      ) : activePromos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>Aucune promotion. Cliquez sur "Créer une promotion" pour commencer.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {activePromos.map((promo) => (
            <Card key={promo.id} className="border">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{promo.name}</h3>
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      {promo.type === "buy_x_get_y" ? <Gift className="w-3 h-3" /> : <Percent className="w-3 h-3" />}
                      {promo.type === "buy_x_get_y" ? "Offre" : "Réduction"}
                    </Badge>
                    {promo.gymId && (
                      <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">
                        {gymById.get(promo.gymId) || promo.gymId}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{describePromotion(promo)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => handleToggleActive(promo)}
                    variant="outline"
                    size="sm"
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-900"
                  >
                    Désactiver
                  </Button>
                  <Button onClick={() => openEdit(promo)} variant="outline" size="sm">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => { setPromoToDelete(promo.id); setShowDeleteConfirm(true) }}
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

      {inactivePromos.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            {inactivePromos.length} promotion(s) désactivée(s)
          </summary>
          <div className="grid gap-2 mt-2">
            {inactivePromos.map((promo) => (
              <Card key={promo.id} className="border border-gray-100 opacity-60">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm text-gray-500 line-through">{promo.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{describePromotion(promo)}</span>
                  </div>
                  <Button
                    onClick={() => handleToggleActive(promo)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Réactiver
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      )}

      {/* Dialog Créer / Modifier promotion */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPromo ? "Modifier la promotion" : "Créer une promotion"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label className="text-sm font-medium">Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex : 2 achetés 1 offert"
                className="mt-1"
              />
            </div>

            {!editingPromo && (
              <div>
                <Label className="text-sm font-medium">Type de promotion</Label>
                <Select value={form.type} onValueChange={(v: PromoType) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy_x_get_y">X acheté(s) → Y offert(s)</SelectItem>
                    <SelectItem value="percentage">Réduction en %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.type === "buy_x_get_y" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Produit acheté</Label>
                    <Select value={form.buyProductId} onValueChange={(v) => setForm((f) => ({ ...f, buyProductId: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Quantité achetée</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.buyQuantity}
                      onChange={(e) => setForm((f) => ({ ...f, buyQuantity: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Produit offert</Label>
                    <Select value={form.getProductId || "_same"} onValueChange={(v) => setForm((f) => ({ ...f, getProductId: v === "_same" ? "" : v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Même produit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_same">Même produit</SelectItem>
                        {activeProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Quantité offerte</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.getQuantity}
                      onChange={(e) => setForm((f) => ({ ...f, getQuantity: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Ex : "1 acheté 1 offert" → produit offert = même produit, quantités 1 et 1.
                  "2 produits achetés → 1 serviette offerte" → produit offert = Serviette, quantités 2 et 1.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Réduction (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={form.percentage}
                    onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">S'applique à</Label>
                  <Select value={form.targetScope} onValueChange={(v: TargetScope) => setForm((f) => ({ ...f, targetScope: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les articles</SelectItem>
                      <SelectItem value="category">Une catégorie</SelectItem>
                      <SelectItem value="product">Un produit précis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.targetScope === "product" && (
                  <Select value={form.targetProductId} onValueChange={(v) => setForm((f) => ({ ...f, targetProductId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un produit…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {form.targetScope === "category" && (
                  <Select value={form.targetCategory} onValueChange={(v) => setForm((f) => ({ ...f, targetCategory: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une catégorie…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

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
              {editingPromo ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertTriangle className="h-5 w-5 text-red-600" /> Désactiver la promotion
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">La promotion ne s'appliquera plus aux nouvelles ventes, mais l'historique est conservé.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setPromoToDelete(null) }}>
              <X className="mr-2 h-4 w-4" /> Annuler
            </Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              <Trash2 className="mr-2 h-4 w-4" /> Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
