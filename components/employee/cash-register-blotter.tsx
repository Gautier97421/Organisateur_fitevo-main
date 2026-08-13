"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Banknote, Loader2, Calculator } from "lucide-react"
import { CashRegisterForm } from "./cash-register-form"
import { getUserId } from "@/lib/current-user"

interface CashRegisterBlotterProps {
  period: "matin" | "aprem" | "journee"
  gymId?: string
  gymName?: string
  userEmail: string
  userName: string
}

function euros(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

export function CashRegisterBlotter({ period, gymId, gymName, userEmail, userName }: CashRegisterBlotterProps) {
  const [cashFormOpen, setCashFormOpen] = useState(false)
  const [cashSaving, setCashSaving] = useState(false)
  const [cashInitialData, setCashInitialData] = useState<{
    coinCounts?: Record<string, number>
    customFieldValues?: Record<string, any>
    notes?: string
  } | null>(null)
  const [lastCashEntry, setLastCashEntry] = useState<{ total: number; at: string } | null>(null)

  const loadLastCashEntry = useCallback(async () => {
    try {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      const params = new URLSearchParams({ month })
      if (gymId) params.set("gym_id", gymId)
      const res = await fetch(`/api/db/cash-register-entries?${params.toString()}`, { credentials: "same-origin" })
      if (!res.ok) return
      const json = await res.json()
      const all: any[] = Array.isArray(json.data) ? json.data : []
      const todayStr = now.toISOString().split("T")[0]
      const todayMine = all.filter((e) =>
        e.user_email === userEmail
        && e.period === period
        && (e.entry_date || "").startsWith(todayStr)
        && typeof e.notes === "string"
      )
      // "Dernier comptage" = le dernier recomptage volontaire fait pendant la période, ou à
      // défaut le comptage d'ouverture — sinon l'onglet reste vide juste après l'ouverture alors
      // que la caisse de départ vient d'être saisie.
      const pendant = todayMine.filter((e) => e.notes.includes("[PENDANT]"))
      const ouverture = todayMine.filter((e) => e.notes.includes("[OUVERTURE]"))
      const source = pendant.length > 0 ? pendant : ouverture
      if (source.length === 0) {
        setLastCashEntry(null)
        setCashInitialData(null)
        return
      }
      const latest = source[source.length - 1]
      const custom = (latest.custom_values || {}) as Record<string, any>
      // Le comptage d'ouverture a longtemps été enregistré sous "_coinCounts" (la clé brute
      // renvoyée par le formulaire), les recomptages sous "__coinCounts" : on lit les deux,
      // sinon le détail des pièces d'une ouverture repart à zéro à la modification.
      const rawCoinCounts = custom.__coinCounts ?? custom._coinCounts
      const coinCounts = (rawCoinCounts && typeof rawCoinCounts === "object")
        ? rawCoinCounts as Record<string, number>
        : undefined
      setCashInitialData({
        coinCounts,
        notes: (latest.notes || "").replace(/^\[(PENDANT|OUVERTURE)\]\s*/, ""),
      })
      setLastCashEntry({
        total: Number(latest.total_register || 0),
        at: latest.created_at,
      })
    } catch {
      // silencieux
    }
  }, [userEmail, period, gymId])

  useEffect(() => { loadLastCashEntry() }, [loadLastCashEntry])

  const openCashForm = async () => {
    await loadLastCashEntry()
    setCashFormOpen(true)
  }

  const handleCashSubmit = async (cashData: any) => {
    setCashSaving(true)
    try {
      const userId = getUserId() || ""
      const { _coinCounts, cash_amount, total_register, coins_detail, notes } = cashData
      const customValues: Record<string, any> = {}
      if (_coinCounts) customValues.__coinCounts = _coinCounts

      const mergedNotes = `[PENDANT] ${notes || ""}`.trim()
      const res = await fetch("/api/db/cash-register-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-user-email": userEmail,
        },
        body: JSON.stringify({
          entryDate: new Date().toISOString(),
          period,
          gymId: gymId || null,
          userEmail,
          userName,
          totalRegister: Number(total_register || 0),
          cashAmount: Number(cash_amount || 0),
          coinsDetail: coins_detail || "",
          notes: mergedNotes,
          customValues,
        }),
      })
      if (!res.ok) {
        toast.error("Impossible d'enregistrer le comptage de caisse.")
        return
      }
      toast.success("Comptage de caisse enregistré.")
      setCashFormOpen(false)
      await loadLastCashEntry()
    } finally {
      setCashSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
          <Banknote className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-base">Caisse</h2>
          <p className="text-xs text-gray-500">{gymName ? `${gymName} · ` : ""}Période en cours</p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
          <Calculator className="w-7 h-7 text-blue-700" />
        </div>
        <div>
          <p className="text-base font-semibold text-blue-900">Comptage de caisse</p>
          {lastCashEntry ? (
            <p className="text-sm text-blue-700 mt-1">
              Dernier comptage : <strong>{euros(lastCashEntry.total)}</strong>
              <br />
              <span className="text-xs">
                à {new Date(lastCashEntry.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
          ) : (
            <p className="text-sm text-blue-700 mt-1">Pas encore de comptage aujourd'hui.</p>
          )}
        </div>
        <Button
          onClick={openCashForm}
          disabled={cashSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
        >
          {cashSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          <span className="ml-2">{lastCashEntry ? "Modifier le comptage" : "Compter la caisse"}</span>
        </Button>
        <p className="text-xs text-gray-500 max-w-md">
          Vous pouvez compter et recompter la caisse autant de fois que nécessaire pendant votre période de travail.
        </p>
      </div>

      <CashRegisterForm
        isOpen={cashFormOpen}
        onClose={() => setCashFormOpen(false)}
        onSubmit={handleCashSubmit}
        period={period}
        gymId={gymId}
        mode="during"
        initialData={cashInitialData}
      />
    </div>
  )
}
