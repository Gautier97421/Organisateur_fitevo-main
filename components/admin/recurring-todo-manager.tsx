"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { RefreshCw, Plus, Pencil, Trash2, Users, Tag, CalendarDays, XCircle, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { getUserId } from "@/lib/current-user"

interface RecurringTask {
  id: string
  title: string
  description?: string | null
  recurrenceType: string
  recurrenceInterval: number
  startDate: string
  assignedRoleIds: string[]
  assignedUserEmails: string[]
  gymId?: string | null
  isActive: boolean
  createdAt: string
}

interface Role {
  id: string
  name: string
  color: string
}

interface Employee {
  id: string
  name: string
  email: string
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "jour(s)",
  weekly: "semaine(s)",
  monthly: "mois",
}

function nextOccurrenceLabel(startDate: string, type: string, interval: number): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startDate + "T00:00:00")
  start.setHours(0, 0, 0, 0)

  if (today < start) return `Débute le ${start.toLocaleDateString("fr-FR")}`

  const check = (d: Date) => {
    if (type === "daily") {
      const diff = Math.round((d.getTime() - start.getTime()) / 86400000)
      return diff % interval === 0
    }
    if (type === "weekly") {
      const diff = Math.round((d.getTime() - start.getTime()) / 86400000)
      return diff % (interval * 7) === 0
    }
    if (type === "monthly") {
      const yearDiff = d.getFullYear() - start.getFullYear()
      const monthDiff = yearDiff * 12 + (d.getMonth() - start.getMonth())
      return monthDiff >= 0 && monthDiff % interval === 0 && d.getDate() === start.getDate()
    }
    return false
  }

  if (check(today)) return "Aujourd'hui"

  const next = new Date(today)
  for (let i = 1; i <= 366; i++) {
    next.setDate(next.getDate() + 1)
    if (check(new Date(next))) return `Prochaine : ${next.toLocaleDateString("fr-FR")}`
  }
  return ""
}

const emptyForm = {
  title: "",
  description: "",
  recurrenceType: "daily" as "daily" | "weekly" | "monthly",
  recurrenceInterval: 1,
  startDate: new Date().toISOString().split("T")[0],
  excludeWeekends: false,
  assignedRoleIds: [] as string[],
  assignedUserEmails: [] as string[],
  gymId: "",
}

export function RecurringTodoManager() {
  const [tasks, setTasks] = useState<RecurringTask[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterRole, setFilterRole] = useState<string>("all")
  const [filterEmployee, setFilterEmployee] = useState<string>("all")
  const [showDialog, setShowDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setIsLoading(true)
    try {
      const [tasksRes, rolesRes, empRes] = await Promise.all([
        fetch("/api/recurring-tasks?admin=true"),
        fetch("/api/roles"),
        fetch("/api/db/employees?is_active=true"),
      ])
      const tasksJson = tasksRes.ok ? await tasksRes.json() : { data: [] }
      const rolesJson = rolesRes.ok ? await rolesRes.json() : { data: [] }
      const empJson = empRes.ok ? await empRes.json() : { data: [] }
      setTasks(Array.isArray(tasksJson.data) ? tasksJson.data : [])
      setRoles(Array.isArray(rolesJson.data) ? rolesJson.data : [])
      setEmployees(Array.isArray(empJson.data) ? empJson.data : [])
    } catch {
      toast.error("Erreur lors du chargement")
    } finally {
      setIsLoading(false)
    }
  }

  const openCreate = () => {
    setEditingTask(null)
    setForm(emptyForm)
    setShowDialog(true)
  }

  const openEdit = (task: RecurringTask) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || "",
      recurrenceType: task.recurrenceType as "daily" | "weekly" | "monthly",
      recurrenceInterval: task.recurrenceInterval,
      startDate: task.startDate,
      excludeWeekends: (task as any).excludeWeekends ?? false,
      assignedRoleIds: Array.isArray(task.assignedRoleIds) ? task.assignedRoleIds : [],
      assignedUserEmails: Array.isArray(task.assignedUserEmails) ? task.assignedUserEmails : [],
      gymId: task.gymId || "",
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Le titre est obligatoire")
      return
    }

    const payload = {
      title: form.title,
      description: form.description,
      recurrenceType: form.recurrenceType,
      recurrenceInterval: form.recurrenceInterval,
      startDate: form.startDate,
      excludeWeekends: form.recurrenceType === "daily" ? form.excludeWeekends : false,
      assignedRoleIds: form.assignedRoleIds,
      assignedUserEmails: form.assignedUserEmails,
      gymId: form.gymId || null,
    }

    try {
      const url = editingTask ? `/api/recurring-tasks/${editingTask.id}` : "/api/recurring-tasks"
      const method = editingTask ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(editingTask ? "Tâche modifiée" : "Tâche créée")
      setShowDialog(false)
      loadAll()
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    }
  }

  const handleDelete = async () => {
    if (!taskToDelete) return
    try {
      await fetch(`/api/recurring-tasks/${taskToDelete}`, { method: "DELETE" })
      toast.success("Tâche supprimée")
      setShowDeleteConfirm(false)
      setTaskToDelete(null)
      loadAll()
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  const toggleRole = (roleId: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      assignedRoleIds: checked
        ? [...f.assignedRoleIds, roleId]
        : f.assignedRoleIds.filter((id) => id !== roleId),
    }))
  }

  const toggleEmployee = (email: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      assignedUserEmails: checked
        ? [...f.assignedUserEmails, email]
        : f.assignedUserEmails.filter((e) => e !== email),
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-red-600" />
            To-Do récurrentes
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Tâches qui apparaissent automatiquement selon une récurrence</p>
        </div>
        <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700 text-white gap-2">
          <Plus className="h-4 w-4" /> Nouvelle
        </Button>
      </div>

      {/* Filtres */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[180px] h-8 text-xs border rounded-lg">
              <SelectValue placeholder="Filtrer par rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="global">Sans assignation</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[200px] h-8 text-xs border rounded-lg">
              <SelectValue placeholder="Filtrer par employé" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les employés</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.email}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filterRole !== "all" || filterEmployee !== "all") && (
            <button
              onClick={() => { setFilterRole("all"); setFilterEmployee("all") }}
              className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
            >
              <XCircle className="h-3.5 w-3.5" /> Réinitialiser
            </button>
          )}
        </div>
      )}

      {(() => {
        const toStringArray = (v: unknown): string[] =>
          Array.isArray(v) ? v.map(String) : []

        const filtered = tasks.filter((t) => {
          const roleIds = toStringArray(t.assignedRoleIds)
          const userEmails = toStringArray(t.assignedUserEmails)
          const isGlobal = roleIds.length === 0 && userEmails.length === 0

          if (filterRole === "global") return isGlobal
          if (filterRole !== "all" && !roleIds.includes(filterRole)) return false
          if (filterEmployee !== "all" && !userEmails.includes(filterEmployee)) return false
          return true
        })

        return filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{tasks.length === 0 ? "Aucune tâche récurrente" : "Aucun résultat pour ce filtre"}</p>
            {tasks.length === 0 && <p className="text-sm mt-1">Créez votre première tâche récurrente</p>}
          </div>
        ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const roleIds = toStringArray(task.assignedRoleIds)
            const userEmails = toStringArray(task.assignedUserEmails)
            return (
              <Card key={task.id} className="border-0 shadow-md bg-white dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{task.title}</h3>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                          Tous les {task.recurrenceInterval} {RECURRENCE_LABELS[task.recurrenceType]}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {nextOccurrenceLabel(task.startDate, task.recurrenceType, task.recurrenceInterval)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {roleIds.length === 0 && userEmails.length === 0 ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            Tous les employés
                          </span>
                        ) : (
                          <>
                            {roleIds.map((rid) => {
                              const role = roles.find((r) => r.id === rid)
                              return role ? (
                                <span
                                  key={rid}
                                  className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                                  style={{ backgroundColor: role.color }}
                                >
                                  {role.name}
                                </span>
                              ) : null
                            })}
                            {userEmails.map((email) => {
                              const emp = employees.find((e) => e.email === email)
                              return (
                                <span key={email} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  {emp?.name || email}
                                </span>
                              )
                            })}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(task)}
                        className="text-blue-600 hover:bg-blue-50 border-blue-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setTaskToDelete(task.id); setShowDeleteConfirm(true) }}
                        className="text-red-600 hover:bg-red-50 border-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        )
      })()}

      {/* Dialog création/édition */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-red-600" />
              {editingTask ? "Modifier la tâche récurrente" : "Nouvelle tâche récurrente"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Titre <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Ex: Nettoyage des vestiaires"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="border-2 rounded-xl"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Description</label>
              <Textarea
                placeholder="Description optionnelle..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="border-2 rounded-xl"
                rows={2}
              />
            </div>

            {/* Récurrence */}
            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-800">Récurrence</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Type</label>
                  <Select
                    value={form.recurrenceType}
                    onValueChange={(v) => setForm({ ...form, recurrenceType: v as "daily" | "weekly" | "monthly" })}
                  >
                    <SelectTrigger className="border-2 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Quotidienne</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      <SelectItem value="monthly">Mensuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">
                    Tous les N {RECURRENCE_LABELS[form.recurrenceType]}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={form.recurrenceInterval}
                    onChange={(e) => setForm({ ...form, recurrenceInterval: Math.max(1, Number(e.target.value)) })}
                    className="border-2 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Date de début</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="border-2 rounded-xl"
                />
              </div>
              {form.recurrenceType === "daily" && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={form.excludeWeekends}
                    onCheckedChange={(checked) => setForm({ ...form, excludeWeekends: Boolean(checked) })}
                  />
                  <span className="text-sm text-gray-700">Prendre en compte les weekends</span>
                  <span className="text-xs text-gray-400">(décoché = exclure sam/dim)</span>
                </label>
              )}
              {form.startDate && (
                <p className="text-xs text-gray-500">
                  {nextOccurrenceLabel(form.startDate, form.recurrenceType, form.recurrenceInterval)}
                </p>
              )}
            </div>

            {/* Assignation */}
            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-800">
                Assignation <span className="text-xs font-normal text-gray-400">(vide = tous les employés)</span>
              </p>

              {roles.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Par rôle
                  </label>
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-100 p-2 space-y-1.5">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <Checkbox
                          checked={form.assignedRoleIds.includes(role.id)}
                          onCheckedChange={(checked) => toggleRole(role.id, Boolean(checked))}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {employees.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Par employé
                  </label>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-100 p-2 space-y-1.5">
                    {employees.map((emp) => (
                      <label key={emp.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <Checkbox
                          checked={form.assignedUserEmails.includes(emp.email)}
                          onCheckedChange={(checked) => toggleEmployee(emp.email, Boolean(checked))}
                        />
                        {emp.name}
                        <span className="text-xs text-gray-400 truncate">({emp.email})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="gap-2">
              <XCircle className="h-4 w-4" /> Annuler
            </Button>
            <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              <CheckCircle className="h-4 w-4" /> {editingTask ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>Supprimer cette tâche ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            La tâche sera définitivement supprimée, ainsi que tout son historique de complétion.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Annuler</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
