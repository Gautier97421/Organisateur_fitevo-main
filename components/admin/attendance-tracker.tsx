"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, CalendarDays, Clock, Download, Loader2, QrCode, Trash2, Users, XCircle } from "lucide-react"
import { toast } from "sonner"
import { getIsSuperAdmin, getUserRole } from "@/lib/current-user"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface TimeEntry {
  id: string
  employeeName: string
  employeeEmail: string
  checkInTime: string
  checkOutTime?: string | null
  source?: string
  gym?: { id: string; name: string } | null
  gymId: string
}

interface Gym {
  id: string
  name: string
}

/** Jour local "YYYY-MM-DD" (le décalage d'`toISOString` fausserait la borne de début). */
function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function firstDayOfMonth(): string {
  const now = new Date()
  return dayKey(new Date(now.getFullYear(), now.getMonth(), 1))
}

function durationMs(entry: TimeEntry): number | null {
  if (!entry.checkOutTime) return null
  return new Date(entry.checkOutTime).getTime() - new Date(entry.checkInTime).getTime()
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")}`
}

function heure(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function jour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
}

export function AttendanceTracker() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [from, setFrom] = useState(firstDayOfMonth())
  const [to, setTo] = useState(dayKey(new Date()))
  const [gymId, setGymId] = useState("all")
  const [employee, setEmployee] = useState("all")
  // La suppression d'un pointage est une donnée de temps de travail : superadmin uniquement
  // (l'API applique la même règle, l'affichage ne fait que suivre).
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setIsSuperAdmin(getUserRole() === "superadmin" || getIsSuperAdmin()) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set("date_from", `${from}T00:00:00`)
      if (to) params.set("date_to", `${to}T23:59:59.999`)
      if (gymId !== "all") params.set("gym_id", gymId)
      const res = await fetch(`/api/time-entries?${params.toString()}`, { credentials: "same-origin" })
      if (!res.ok) {
        setEntries([])
        return
      }
      const json = await res.json()
      setEntries(Array.isArray(json.data) ? json.data : [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [from, to, gymId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch("/api/db/gyms?is_active=true")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setGyms(Array.isArray(j.data) ? j.data : []))
      .catch(() => setGyms([]))
  }, [])

  const employees = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) map.set(e.employeeEmail, e.employeeName)
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [entries])

  const filtered = useMemo(() => {
    const list = employee === "all" ? entries : entries.filter((e) => e.employeeEmail === employee)
    return [...list].sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())
  }, [entries, employee])

  const totals = useMemo(() => {
    let worked = 0
    let open = 0
    for (const e of filtered) {
      const d = durationMs(e)
      if (d === null) open++
      else worked += d
    }
    return { worked, open, count: filtered.length }
  }, [filtered])

  /** Total travaillé par employé — sert au tableau récapitulatif du PDF. */
  const byEmployee = useMemo(() => {
    const map = new Map<string, { name: string; ms: number; count: number; open: number }>()
    for (const e of filtered) {
      const cur = map.get(e.employeeEmail) || { name: e.employeeName, ms: 0, count: 0, open: 0 }
      const d = durationMs(e)
      if (d === null) cur.open++
      else cur.ms += d
      cur.count++
      map.set(e.employeeEmail, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.ms - a.ms)
  }, [filtered])

  const deleteEntry = async () => {
    if (!entryToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/time-entries/${entryToDelete.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error || "Suppression impossible.")
        return
      }
      toast.success("Pointage supprimé.")
      setEntryToDelete(null)
      await load()
    } catch {
      toast.error("Suppression impossible.")
    } finally {
      setDeleting(false)
    }
  }

  const exportPdf = async () => {
    if (filtered.length === 0) {
      toast.error("Aucun pointage à exporter sur cette période.")
      return
    }
    setExporting(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ])

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const gymLabel = gymId === "all" ? "Toutes les salles" : (gyms.find((g) => g.id === gymId)?.name || "Salle")
      const employeeLabel = employee === "all"
        ? "Tous les employés"
        : (employees.find(([mail]) => mail === employee)?.[1] || employee)

      doc.setFontSize(16)
      doc.text("Suivi des pointages", 14, 18)
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(
        `${gymLabel} · ${employeeLabel} · du ${new Date(`${from}T00:00:00`).toLocaleDateString("fr-FR")} au ${new Date(`${to}T00:00:00`).toLocaleDateString("fr-FR")}`,
        14, 25,
      )
      doc.text(
        `${totals.count} pointage(s) · ${formatDuration(totals.worked)} travaillées${totals.open ? ` · ${totals.open} sans départ` : ""}`,
        14, 31,
      )

      autoTable(doc, {
        startY: 38,
        head: [["Date", "Employé", "Salle", "Arrivée", "Départ", "Durée", "Source"]],
        body: filtered.map((e) => {
          const d = durationMs(e)
          return [
            jour(e.checkInTime),
            e.employeeName,
            e.gym?.name || "—",
            heure(e.checkInTime),
            heure(e.checkOutTime),
            d === null ? "En cours" : formatDuration(d),
            e.source === "qr" ? "QR code" : "Application",
          ]
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [220, 38, 38], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      })

      if (byEmployee.length > 1) {
        const y = (doc as any).lastAutoTable?.finalY ?? 38
        autoTable(doc, {
          startY: y + 8,
          head: [["Total par employé", "Pointages", "Heures travaillées"]],
          body: byEmployee.map((r) => [
            r.name,
            String(r.count) + (r.open ? ` (${r.open} sans départ)` : ""),
            formatDuration(r.ms),
          ]),
          styles: { fontSize: 9, cellPadding: 2.5 },
          headStyles: { fillColor: [55, 65, 81], textColor: 255 },
        })
      }

      doc.save(`pointages-${from}-${to}.pdf`)
    } catch {
      toast.error("Impossible de générer le PDF.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Du</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border-2 rounded-xl bg-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Au</label>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="border-2 rounded-xl bg-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Salle</label>
            <Select value={gymId} onValueChange={setGymId}>
              <SelectTrigger className="border-2 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les salles</SelectItem>
                {gyms.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Employé</label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger className="border-2 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les employés</SelectItem>
                {employees.map(([mail, name]) => <SelectItem key={mail} value={mail}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={exportPdf} disabled={exporting || loading} className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="ml-2">PDF</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totaux */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={<CalendarDays className="w-5 h-5 text-red-600" />} label="Pointages" value={String(totals.count)} />
        <StatCard icon={<Clock className="w-5 h-5 text-green-600" />} label="Heures travaillées" value={formatDuration(totals.worked)} />
        <StatCard icon={<Users className="w-5 h-5 text-amber-600" />} label="Sans départ" value={String(totals.open)} />
      </div>

      {/* Tableau */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>Aucun pointage sur cette période.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Date</th>
                    <th className="text-left font-medium px-4 py-2.5">Employé</th>
                    <th className="text-left font-medium px-4 py-2.5">Salle</th>
                    <th className="text-left font-medium px-4 py-2.5">Arrivée</th>
                    <th className="text-left font-medium px-4 py-2.5">Départ</th>
                    <th className="text-left font-medium px-4 py-2.5">Durée</th>
                    {isSuperAdmin && <th className="w-10 px-2 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const d = durationMs(e)
                    return (
                      <tr key={e.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{jour(e.checkInTime)}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-gray-900">{e.employeeName}</span>
                          {e.source === "qr" && (
                            <Badge variant="outline" className="ml-2 text-[10px] gap-1 border-gray-200 text-gray-500">
                              <QrCode className="w-3 h-3" /> QR
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{e.gym?.name || "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{heure(e.checkInTime)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{heure(e.checkOutTime)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {d === null
                            ? <span className="text-amber-600 font-medium">En cours</span>
                            : <span className="font-semibold text-gray-900">{formatDuration(d)}</span>}
                        </td>
                        {isSuperAdmin && (
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => setEntryToDelete(e)}
                              title="Supprimer ce pointage"
                              aria-label="Supprimer ce pointage"
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!entryToDelete} onOpenChange={(open) => { if (!open) setEntryToDelete(null) }}>
        <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" /> Supprimer ce pointage
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Cette suppression est définitive et retire le temps de travail correspondant du suivi.
            </DialogDescription>
          </DialogHeader>
          {entryToDelete && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">{entryToDelete.employeeName}</p>
              <p className="text-gray-600">
                {jour(entryToDelete.checkInTime)} · {entryToDelete.gym?.name || "—"} ·{" "}
                {heure(entryToDelete.checkInTime)} → {heure(entryToDelete.checkOutTime)}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:flex-wrap sm:justify-center">
            <Button variant="outline" onClick={() => setEntryToDelete(null)} className="whitespace-nowrap">
              <XCircle className="mr-2 h-4 w-4 flex-shrink-0" /> Annuler
            </Button>
            <Button onClick={deleteEntry} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap">
              {deleting
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Trash2 className="mr-2 h-4 w-4 flex-shrink-0" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
