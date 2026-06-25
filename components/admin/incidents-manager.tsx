"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Banknote, Building2, CalendarDays, Camera, RefreshCw, User, Wrench } from "lucide-react"

interface CashRegisterField {
  id: string
  label: string
  fieldType?: string
  allowPhoto?: boolean
  reportIncident?: boolean
}

interface Gym {
  id: string
  name: string
}

interface CashRegisterEntry {
  id: string
  entry_date: string
  entry_month: string
  period: "matin" | "aprem" | "journee"
  gym_id?: string | null
  user_email: string
  user_name?: string
  total_register: number
  cash_amount: number
  notes?: string | null
  custom_values?: Record<string, any> | null
}

function entryMode(notes?: string | null): "Ouverture" | "Fermeture" | null {
  if (notes?.includes("[OUVERTURE]")) return "Ouverture"
  if (notes?.includes("[FIN_PERIODE]")) return "Fermeture"
  return null
}

function periodLabel(period: string): string {
  if (period === "matin") return "Matin"
  if (period === "aprem") return "Après-midi"
  return "Journée"
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface CashGapRow {
  entry: CashRegisterEntry
  gap: number
}

interface FieldIncidentRow {
  entry: CashRegisterEntry
  fieldId: string
  field?: CashRegisterField
  value: any
  photos: string[]
}

export function IncidentsManager() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [entries, setEntries] = useState<CashRegisterEntry[]>([])
  const [fields, setFields] = useState<CashRegisterField[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [gymFilter, setGymFilter] = useState<string>("all")
  const [periodFilter, setPeriodFilter] = useState<"all" | "matin" | "aprem" | "journee">("all")
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [entriesRes, fieldsRes, gymsRes] = await Promise.all([
        fetch(`/api/db/cash-register-entries?month=${selectedMonth}`),
        fetch("/api/db/cash-register-fields"),
        fetch("/api/db/gyms"),
      ])

      if (entriesRes.ok) {
        const payload = await entriesRes.json()
        setEntries(Array.isArray(payload.data) ? payload.data : [])
      } else {
        setEntries([])
      }

      if (fieldsRes.ok) {
        const payload = await fieldsRes.json()
        const rows = Array.isArray(payload.data) ? payload.data : []
        setFields(rows)
      }

      if (gymsRes.ok) {
        const payload = await gymsRes.json()
        const rows = Array.isArray(payload.data) ? payload.data : []
        setGyms(rows.map((g: any) => ({ id: g.id, name: g.name })))
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  const gymById = useMemo(() => {
    const map = new Map<string, string>()
    gyms.forEach((g) => map.set(g.id, g.name))
    return map
  }, [gyms])

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (gymFilter !== "all") {
        if ((e.gym_id || "") !== gymFilter) return false
      }
      if (periodFilter !== "all" && e.period !== periodFilter) return false
      return true
    })
  }, [entries, gymFilter, periodFilter])

  // Écarts de caisse : entrées de fermeture où cash_amount diffère de total_register
  const cashGaps: CashGapRow[] = useMemo(() => {
    const rows: CashGapRow[] = []
    filteredEntries.forEach((entry) => {
      if (entryMode(entry.notes) !== "Fermeture") return
      const gap = Number(entry.cash_amount || 0) - Number(entry.total_register || 0)
      if (Math.abs(gap) < 0.01) return
      rows.push({ entry, gap })
    })
    rows.sort((a, b) => new Date(b.entry.entry_date).getTime() - new Date(a.entry.entry_date).getTime())
    return rows
  }, [filteredEntries])

  // Incidents : champs marqués reportIncident.
  // On regroupe par (user, salle, période, jour, champ) :
  //  - la valeur affichée est celle de l'entrée la plus récente avec une valeur non vide
  //  - les photos sont l'union de TOUTES les entrées de ce groupe (afin de ne pas
  //    perdre une photo enregistrée dans une saisie "INFOS PENDANT" lorsqu'une
  //    entrée de fermeture postérieure ré-enregistre la même valeur sans photo).
  const fieldIncidents: FieldIncidentRow[] = useMemo(() => {
    const incidentFields = fields.filter((f) => f.reportIncident || f.allowPhoto)
    if (incidentFields.length === 0) return []
    const map = new Map<string, FieldIncidentRow>()
    filteredEntries.forEach((entry) => {
      const custom = (entry.custom_values || {}) as Record<string, any>
      const dateOnly = (entry.entry_date || "").slice(0, 10)
      incidentFields.forEach((field) => {
        const value = custom[field.id]
        const photosFromEntry: string[] = []
        const arr = custom[`__photos:${field.id}`]
        if (Array.isArray(arr)) {
          arr.forEach((p) => { if (p) photosFromEntry.push(String(p)) })
        }
        const single = custom[`__photo:${field.id}`]
        if (single) photosFromEntry.push(String(single))

        const hasValue =
          !(value === undefined || value === null || value === "") &&
          !(field.fieldType === "checkbox" && !value)
        const hasPhoto = photosFromEntry.length > 0
        if (!hasValue && !hasPhoto) return

        const key = `${entry.user_email}|${entry.gym_id || ""}|${entry.period}|${dateOnly}|${field.id}`
        const existing = map.get(key)
        if (!existing) {
          map.set(key, {
            entry,
            fieldId: field.id,
            field,
            value: hasValue ? value : null,
            photos: photosFromEntry,
          })
          return
        }

        // Union des photos (dédupliquées)
        if (photosFromEntry.length > 0) {
          const merged = new Set(existing.photos)
          photosFromEntry.forEach((p) => merged.add(p))
          existing.photos = Array.from(merged)
        }

        // L'entrée la plus récente devient la référence pour la date + l'utilisateur.
        const isNewer = new Date(entry.entry_date).getTime() > new Date(existing.entry.entry_date).getTime()
        if (isNewer) {
          existing.entry = entry
          if (hasValue) existing.value = value
        } else if (existing.value === null && hasValue) {
          existing.value = value
        }
      })
    })
    const rows = Array.from(map.values())
    rows.sort((a, b) => new Date(b.entry.entry_date).getTime() - new Date(a.entry.entry_date).getTime())
    return rows
  }, [filteredEntries, fields])

  const formatFieldValue = (value: any, field?: CashRegisterField): string => {
    if (value === null || value === undefined || value === "") return "—"
    if (field?.fieldType === "checkbox" || typeof value === "boolean") {
      return value ? "Oui" : "Non"
    }
    if (typeof value === "number") return String(value)
    return String(value)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Incidents</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={gymFilter} onValueChange={setGymFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Salle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les salles</SelectItem>
              {gyms.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-[180px]"
          />
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-700">
              <Banknote className="h-4 w-4 text-red-600" /> Écarts de caisse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{cashGaps.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">période(s) avec écart non nul</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-700">
              <Wrench className="h-4 w-4 text-amber-600" /> Informations & signalements terrain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{fieldIncidents.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">entrée(s) avec photo ou signalement terrain</p>
          </CardContent>
        </Card>
      </div>

      {/* Écarts de caisse */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="h-5 w-5 text-red-600" /> Écarts de caisse (fermeture)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-sm">Chargement…</p>
          ) : cashGaps.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun écart sur la période sélectionnée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600">
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">Période</th>
                    <th className="text-left p-2 font-medium">Salle</th>
                    <th className="text-left p-2 font-medium">Employé</th>
                    <th className="text-right p-2 font-medium">Total caisse</th>
                    <th className="text-right p-2 font-medium">Liquide</th>
                    <th className="text-right p-2 font-medium">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {cashGaps.map(({ entry, gap }) => (
                    <tr key={entry.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 whitespace-nowrap">{formatDateTime(entry.entry_date)}</td>
                      <td className="p-2"><Badge variant="outline">{periodLabel(entry.period)}</Badge></td>
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {entry.gym_id ? (gymById.get(entry.gym_id) || "—") : "Toutes salles"}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {entry.user_name || entry.user_email}
                        </span>
                      </td>
                      <td className="p-2 text-right">{Number(entry.total_register).toFixed(2)} €</td>
                      <td className="p-2 text-right">{Number(entry.cash_amount).toFixed(2)} €</td>
                      <td className={`p-2 text-right font-semibold ${gap >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {gap >= 0 ? "+" : ""}{gap.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signalements via champs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-amber-600" /> Photos & informations terrain
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-sm">Chargement…</p>
          ) : fieldIncidents.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune information ou photo terrain sur la période sélectionnée.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {fieldIncidents.map((row, idx) => (
                <Card key={`${row.entry.id}-${row.fieldId}-${idx}`} className={`border ${row.field?.reportIncident ? "border-amber-200 bg-amber-50/40" : "border-blue-200 bg-blue-50/30"}`}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 text-sm">
                              {row.field?.label || <span className="italic text-gray-500">Champ supprimé</span>}
                            </h3>
                            {row.field?.reportIncident && (
                              <span className="inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Incident</span>
                            )}
                            {row.field?.allowPhoto && !row.field?.reportIncident && (
                              <span className="inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Info terrain</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 font-medium">
                            {formatFieldValue(row.value, row.field)}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-600 pt-1.5 border-t border-amber-200/60">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" /> {formatDateTime(row.entry.entry_date)}
                            </span>
                            <Badge variant="outline" className="text-xs">{periodLabel(row.entry.period)}</Badge>
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {row.entry.gym_id ? (gymById.get(row.entry.gym_id) || "—") : "Toutes salles"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3 h-3" /> {row.entry.user_name || row.entry.user_email}
                            </span>
                          </div>
                        </div>
                      </div>

                      {row.photos.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {row.photos.map((filename, pidx) => (
                            <button
                              type="button"
                              key={`${filename}-${pidx}`}
                              onClick={() => setPreviewPhoto(filename)}
                              className="block group"
                            >
                              <img
                                src={`/api/incident-photos/${filename}`}
                                alt={`${row.field?.label || "Incident"} – photo ${pidx + 1}`}
                                className="h-24 w-full object-cover rounded-lg border border-gray-200 cursor-zoom-in group-hover:border-amber-400"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                          <Camera className="w-4 h-4" /> Aucune photo jointe
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aperçu photo */}
      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Photo de l'incident</DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <img
              src={`/api/incident-photos/${previewPhoto}`}
              alt="Aperçu"
              className="w-full h-auto rounded-lg max-h-[70vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
