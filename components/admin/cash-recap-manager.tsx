"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BarChart3, Building2, CalendarDays, RefreshCw, PieChart as PieChartIcon } from "lucide-react"
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

interface CashRegisterField {
  id: string
  label: string
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
  gym_id?: string
  user_email: string
  user_name?: string
  total_register: number
  cash_amount: number
  custom_values?: Record<string, any>
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-")
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-")
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  date.setMonth(date.getMonth() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

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

function numericCustomFieldsGrandTotal(entries: CashRegisterEntry[], fields: CashRegisterField[]): number {
  return entries.reduce((entrySum, entry) => {
    const values = (entry.custom_values || {}) as Record<string, any>
    const fieldSum = fields.reduce((sum, field) => {
      const raw = values[field.id]
      if (raw === null || raw === undefined || raw === "") {
        return sum
      }
      const parsed = typeof raw === "number" ? raw : Number.parseFloat(String(raw).replace(",", "."))
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return sum + parsed
      }
      return sum
    }, 0)

    return entrySum + fieldSum
  }, 0)
}

function periodLabel(period: string): string {
  if (period === "matin") return "Matin"
  if (period === "aprem") return "Après-midi"
  return "Journée"
}

export function CashRecapManager() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [entries, setEntries] = useState<CashRegisterEntry[]>([])
  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, CashRegisterEntry[]>>({})
  const [fields, setFields] = useState<CashRegisterField[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<"all" | "matin" | "aprem" | "journee">("all")
  const [gymFilter, setGymFilter] = useState<string>("all")
  const [employeeFilter, setEmployeeFilter] = useState<string>("all")

  const pieColors = [
    "#dc2626",
    "#2563eb",
    "#16a34a",
    "#ea580c",
    "#0891b2",
    "#7c3aed",
    "#db2777",
    "#4f46e5",
  ]

  const loadData = async () => {
    try {
      setIsLoading(true)
      const monthsToCompare = recentMonths(selectedMonth, 6)

      const [entriesRes, fieldsRes, gymsRes, ...monthEntriesResponses] = await Promise.all([
        fetch(`/api/db/cash-register-entries?month=${selectedMonth}`),
        fetch("/api/db/cash-register-fields"),
        fetch("/api/db/gyms"),
        ...monthsToCompare.map((month) => fetch(`/api/db/cash-register-entries?month=${month}`)),
      ])

      if (entriesRes.ok) {
        const payload = await entriesRes.json()
        setEntries(Array.isArray(payload.data) ? payload.data : [])
      }

      if (fieldsRes.ok) {
        const payload = await fieldsRes.json()
        const rows = Array.isArray(payload.data) ? payload.data : []
        setFields(rows.map((item: any) => ({ id: item.id, label: item.label })))
      }

      if (gymsRes.ok) {
        const payload = await gymsRes.json()
        const rows = Array.isArray(payload.data) ? payload.data : []
        setGyms(rows.map((g: any) => ({ id: g.id, name: g.name })))
      }

      const monthlyData: Record<string, CashRegisterEntry[]> = {}
      for (let index = 0; index < monthsToCompare.length; index++) {
        const month = monthsToCompare[index]
        const response = monthEntriesResponses[index]
        if (!response?.ok) {
          monthlyData[month] = []
          continue
        }
        const payload = await response.json()
        monthlyData[month] = Array.isArray(payload.data) ? payload.data : []
      }
      setEntriesByMonth(monthlyData)
    } catch (error) {
      console.error("Erreur chargement récap caisse:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  const displayEntries = useMemo(() => {
    if (gymFilter === "all") return entries
    return entries.filter((e) => (e.gym_id || "global") === gymFilter)
  }, [entries, gymFilter])

  const currentTotals = useMemo(() => {
    const totalRegister = displayEntries.reduce((sum, item) => sum + Number(item.total_register || 0), 0)
    const totalCash = displayEntries.reduce((sum, item) => sum + Number(item.cash_amount || 0), 0)
    return {
      totalRegister,
      totalCash,
      count: displayEntries.length,
      avg: displayEntries.length > 0 ? totalRegister / displayEntries.length : 0,
    }
  }, [displayEntries])

  const numericCustomFieldTotals = useMemo(() => {
    const totals = new Map<string, number>()

    for (const field of fields) {
      totals.set(field.id, 0)
    }

    for (const entry of displayEntries) {
      const values = (entry.custom_values || {}) as Record<string, any>
      for (const field of fields) {
        const raw = values[field.id]
        if (raw === null || raw === undefined || raw === "") {
          continue
        }
        const parsed = typeof raw === "number" ? raw : Number.parseFloat(String(raw).replace(",", "."))
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
          totals.set(field.id, (totals.get(field.id) || 0) + parsed)
        }
      }
    }

    return fields
      .map((field) => ({
        fieldId: field.id,
        label: field.label,
        value: Number((totals.get(field.id) || 0).toFixed(2)),
      }))
      .filter((item) => item.value > 0)
  }, [displayEntries, fields])

  const customFieldsGrandTotal = useMemo(
    () => numericCustomFieldsGrandTotal(displayEntries, fields),
    [displayEntries, fields],
  )

  const monthsToCompare = useMemo(() => recentMonths(selectedMonth, 6), [selectedMonth])

  const monthlyComparisonData = useMemo(() => {
    return monthsToCompare.map((month) => {
      const allMonthEntries = entriesByMonth[month] || []
      const monthEntries =
        gymFilter === "all"
          ? allMonthEntries
          : allMonthEntries.filter((e) => (e.gym_id || "global") === gymFilter)
      const row: Record<string, any> = {
        month,
        monthLabel: monthLabel(month),
      }

      for (const field of fields) {
        const totalForField = monthEntries.reduce((sum, entry) => {
          const values = (entry.custom_values || {}) as Record<string, any>
          const raw = values[field.id]
          if (raw === null || raw === undefined || raw === "") {
            return sum
          }
          const parsed = typeof raw === "number" ? raw : Number.parseFloat(String(raw).replace(",", "."))
          if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
            return sum + parsed
          }
          return sum
        }, 0)

        row[field.id] = Number(totalForField.toFixed(2))
      }

      return row
    })
  }, [entriesByMonth, fields, monthsToCompare, gymFilter])

  const fieldsWithData = useMemo(() => {
    return fields.filter((field) => {
      return monthlyComparisonData.some((row) => Number(row[field.id] || 0) > 0)
    })
  }, [fields, monthlyComparisonData])

  const gymById = useMemo(() => {
    const map = new Map<string, string>()
    gyms.forEach((gym) => map.set(gym.id, gym.name))
    return map
  }, [gyms])

  const perGymSummary = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number; cash: number }>()
    for (const entry of entries) {
      const gymId = entry.gym_id || "global"
      const gymName = gymById.get(gymId) || "Toutes salles"
      if (!map.has(gymId)) {
        map.set(gymId, { name: gymName, count: 0, total: 0, cash: 0 })
      }
      const rec = map.get(gymId)!
      rec.count += 1
      rec.total += Number(entry.total_register || 0)
      rec.cash += Number(entry.cash_amount || 0)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [entries, gymById])

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of displayEntries) {
      map.set(entry.user_email, entry.user_name || entry.user_email)
    }
    return Array.from(map.entries())
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
  }, [displayEntries])

  const filteredEntries = useMemo(() => {
    return displayEntries
      .filter((entry) => {
        if (periodFilter !== "all" && entry.period !== periodFilter) return false
        if (employeeFilter !== "all" && entry.user_email !== employeeFilter) return false
        return true
      })
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
  }, [displayEntries, periodFilter, employeeFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-red-600" />
          Récap Mensuel
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={gymFilter}
            onChange={(e) => setGymFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm h-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">Toutes les salles</option>
            {gyms.map((gym) => (
              <option key={gym.id} value={gym.id}>{gym.name}</option>
            ))}
          </select>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-[180px]"
          />
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total {monthLabel(selectedMonth)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{currentTotals.totalRegister.toFixed(2)} EUR</p>
            <p className="text-sm text-gray-600 mt-1">{currentTotals.count} saisie(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Moyenne par saisie</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{currentTotals.avg.toFixed(2)} EUR</p>
            <p className="text-sm text-gray-600 mt-1">Montant moyen par saisie de caisse</p>
          </CardContent>
        </Card>
      </div>

      {gyms.length > 0 && entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-red-600" />
              Répartition par salle — {monthLabel(selectedMonth)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 font-medium text-gray-600">Salle</th>
                    <th className="text-right p-2 font-medium text-gray-600">Saisies</th>
                    <th className="text-right p-2 font-medium text-gray-600">Total caisse</th>
                    <th className="text-right p-2 font-medium text-gray-600">Espèces</th>
                    <th className="text-right p-2 font-medium text-gray-600">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {perGymSummary.map((row) => {
                    const diff = row.cash - row.total
                    const isSelected = gymFilter !== "all" && gymById.get(gymFilter) === row.name
                    return (
                      <tr
                        key={row.name}
                        className={`border-b hover:bg-gray-50 ${isSelected ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                      >
                        <td className="p-2 font-medium">{row.name}</td>
                        <td className="p-2 text-right text-gray-600">{row.count}</td>
                        <td className="p-2 text-right font-semibold">{row.total.toFixed(2)} EUR</td>
                        <td className="p-2 text-right">{row.cash.toFixed(2)} EUR</td>
                        <td className={`p-2 text-right font-medium ${diff >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {diff >= 0 ? "+" : ""}{diff.toFixed(2)} EUR
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {perGymSummary.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold bg-gray-50">
                      <td className="p-2">Total</td>
                      <td className="p-2 text-right">{perGymSummary.reduce((s, r) => s + r.count, 0)}</td>
                      <td className="p-2 text-right">{perGymSummary.reduce((s, r) => s + r.total, 0).toFixed(2)} EUR</td>
                      <td className="p-2 text-right">{perGymSummary.reduce((s, r) => s + r.cash, 0).toFixed(2)} EUR</td>
                      <td className="p-2 text-right">
                        {(() => {
                          const d = perGymSummary.reduce((s, r) => s + (r.cash - r.total), 0)
                          return (
                            <span className={d >= 0 ? "text-green-700" : "text-red-700"}>
                              {d >= 0 ? "+" : ""}{d.toFixed(2)} EUR
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-red-600" />
            Comparaison multi-mois par champ ({monthsToCompare.length} mois)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-600">Chargement...</p>
          ) : fieldsWithData.length === 0 ? (
            <p className="text-gray-600">Aucune donnée numérique à comparer sur les derniers mois.</p>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={monthlyComparisonData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => Number(value).toFixed(2)} />
                  <Legend />
                  {fieldsWithData.map((field, index) => (
                    <Bar
                      key={field.id}
                      dataKey={field.id}
                      name={field.label}
                      fill={pieColors[index % pieColors.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PieChartIcon className="h-5 w-5 text-red-600" />
            Camembert des champs personnalisés ({monthLabel(selectedMonth)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-600">Chargement...</p>
          ) : numericCustomFieldTotals.length === 0 ? (
            <p className="text-gray-600">
              Aucun champ numérique détecté ce mois-ci. Vérifiez que vos champs personnalisés contiennent des nombres.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={numericCustomFieldTotals}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {numericCustomFieldTotals.map((item, index) => (
                        <Cell key={item.fieldId} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => Number(value).toFixed(2)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {numericCustomFieldTotals.map((item, index) => {
                  const share = customFieldsGrandTotal > 0 ? (item.value / customFieldsGrandTotal) * 100 : 0
                  return (
                    <div key={item.fieldId} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: pieColors[index % pieColors.length] }}
                        />
                        <span className="font-medium text-gray-900">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{item.value.toFixed(2)}</p>
                        <p className="text-xs text-gray-600">{share.toFixed(1)}%</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-red-600" />
            Détail du mois ({filteredEntries.length} ligne(s))
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-600">Chargement...</p>
          ) : entries.length === 0 ? (
            <p className="text-gray-600">Aucune saisie de caisse sur ce mois.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Période</label>
                  <select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value as "all" | "matin" | "aprem" | "journee")}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Toutes</option>
                    <option value="matin">Matin</option>
                    <option value="aprem">Après-midi</option>
                    <option value="journee">Journée</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Employé</label>
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Tous</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.email} value={employee.email}>{employee.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredEntries.length === 0 ? (
                <p className="text-gray-600">Aucune ligne ne correspond aux filtres sélectionnés.</p>
              ) : (
                <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Période</th>
                    <th className="text-left p-2">Salle</th>
                    <th className="text-left p-2">Employé</th>
                    <th className="text-right p-2">Total caisse</th>
                    <th className="text-right p-2">Liquide</th>
                    <th className="text-right p-2">Écart</th>
                    {fields.map((field) => (
                      <th key={field.id} className="text-left p-2">{field.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => {
                    const customValues = (entry.custom_values || {}) as Record<string, any>
                    const diff = Number(entry.cash_amount || 0) - Number(entry.total_register || 0)
                    return (
                      <tr key={entry.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{new Date(entry.entry_date).toLocaleDateString("fr-FR")}</td>
                        <td className="p-2"><Badge variant="outline">{periodLabel(entry.period)}</Badge></td>
                        <td className="p-2">{entry.gym_id ? (gymById.get(entry.gym_id) || "Salle") : "Toutes"}</td>
                        <td className="p-2">{entry.user_name || entry.user_email}</td>
                        <td className="p-2 text-right font-medium">{Number(entry.total_register || 0).toFixed(2)} EUR</td>
                        <td className="p-2 text-right">{Number(entry.cash_amount || 0).toFixed(2)} EUR</td>
                        <td className={`p-2 text-right font-medium ${diff >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {diff >= 0 ? "+" : ""}{diff.toFixed(2)} EUR
                        </td>
                        {fields.map((field) => (
                          <td key={field.id} className="p-2">
                            {customValues[field.id] === undefined || customValues[field.id] === null || customValues[field.id] === ""
                              ? "-"
                              : String(customValues[field.id])}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
