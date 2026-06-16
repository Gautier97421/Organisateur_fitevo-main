"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Banknote, Coins, Plus, Trash2, Loader2, ArrowDownCircle } from "lucide-react"

interface CashRegisterBlotterProps {
  period: "matin" | "aprem" | "journee"
  gymId?: string
  gymName?: string
  userEmail: string
  userName: string
}

interface Movement {
  id: string
  type: "encaissement" | "non_rendu"
  amount: number
  label: string | null
  created_at: string
}

const NON_RENDU_QUICK = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5]

function euros(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

function startEndOfToday(): { start: string; end: string; month: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  return { start: start.toISOString(), end: end.toISOString(), month }
}

/**
 * Brouillard de caisse : pendant une période de travail, l'employé enregistre
 * les encaissements et les "non rendu" (monnaie non restituée au client).
 */
export function CashRegisterBlotter({ period, gymId, gymName, userEmail, userName }: CashRegisterBlotterProps) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [amount, setAmount] = useState("")
  const [label, setLabel] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = startEndOfToday()
      const params = new URLSearchParams({
        user_email: userEmail,
        period,
        movement_date_gte: start,
        movement_date_lte: end,
        orderBy: "created_at",
        orderDir: "asc",
      })
      if (gymId) params.set("gym_id", gymId)
      const res = await fetch(`/api/db/cash_movements?${params.toString()}`, { credentials: "same-origin" })
      if (res.ok) {
        const json = await res.json()
        setMovements(Array.isArray(json.data) ? json.data : [])
      }
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }, [userEmail, period, gymId])

  useEffect(() => { load() }, [load])

  const addMovement = async (type: "encaissement" | "non_rendu", value: number, lbl?: string) => {
    if (!Number.isFinite(value) || value <= 0) return
    setSaving(true)
    try {
      const { month } = startEndOfToday()
      const res = await fetch("/api/db/cash_movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          data: {
            user_email: userEmail,
            user_name: userName,
            gym_id: gymId || null,
            period,
            movement_date: new Date().toISOString(),
            entry_month: month,
            type,
            amount: Math.round(value * 100) / 100,
            label: lbl || null,
          },
        }),
      })
      if (res.ok) {
        setAmount("")
        setLabel("")
        await load()
      }
    } catch {
      // silencieux
    } finally {
      setSaving(false)
    }
  }

  const removeMovement = async (id: string) => {
    try {
      const res = await fetch(`/api/db/cash_movements?id=${id}`, { method: "DELETE", credentials: "same-origin" })
      if (res.ok) setMovements((prev) => prev.filter((m) => m.id !== id))
    } catch {
      // silencieux
    }
  }

  const totalEncaissement = movements.filter((m) => m.type === "encaissement").reduce((s, m) => s + m.amount, 0)
  const totalNonRendu = movements.filter((m) => m.type === "non_rendu").reduce((s, m) => s + m.amount, 0)
  const totalCaisse = totalEncaissement + totalNonRendu

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
          <Banknote className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-base">Brouillard de caisse</h2>
          <p className="text-xs text-gray-500">{gymName ? `${gymName} · ` : ""}Période en cours</p>
        </div>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Encaissements</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{euros(totalEncaissement)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Non rendu</p>
          <p className="text-lg font-bold text-amber-600 mt-1">{euros(totalNonRendu)}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-[10px] font-bold text-green-500 uppercase tracking-wide">Total caisse</p>
          <p className="text-lg font-bold text-green-700 mt-1">{euros(totalCaisse)}</p>
        </div>
      </div>

      {/* Ajouter un encaissement */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <ArrowDownCircle className="w-4 h-4 text-green-600" /> Nouvel encaissement
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="Montant (€)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border-2 rounded-xl bg-white text-gray-900 sm:max-w-[160px]"
          />
          <Input
            placeholder="Libellé (optionnel)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border-2 rounded-xl bg-white text-gray-900 flex-1"
          />
          <Button
            onClick={() => addMovement("encaissement", parseFloat(amount), label)}
            disabled={saving || !(parseFloat(amount) > 0)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="ml-1">Ajouter</span>
          </Button>
        </div>
      </div>

      {/* Non rendu rapide */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-600" /> Non rendu (monnaie gardée)
        </p>
        <div className="flex flex-wrap gap-2">
          {NON_RENDU_QUICK.map((v) => (
            <button
              key={v}
              onClick={() => addMovement("non_rendu", v)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
            >
              +{euros(v)}
            </button>
          ))}
          <button
            onClick={() => { const v = parseFloat(amount); if (v > 0) addMovement("non_rendu", v) }}
            disabled={saving || !(parseFloat(amount) > 0)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            title="Utilise le montant saisi ci-dessus"
          >
            + Montant saisi
          </button>
        </div>
      </div>

      {/* Liste des mouvements */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Mouvements du jour</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : movements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucun mouvement enregistré.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {[...movements].reverse().map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${m.type === "non_rendu" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                  {m.type === "non_rendu" ? "Non rendu" : "Encaiss."}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{euros(m.amount)}</p>
                  {m.label && <p className="text-xs text-gray-500 truncate">{m.label}</p>}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => removeMovement(m.id)}
                  className="text-gray-300 hover:text-red-600 p-1 flex-shrink-0"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
