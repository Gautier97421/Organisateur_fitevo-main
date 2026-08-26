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
import {
  CalendarCheck, Plus, Pencil, Trash2, Users, Tag, CalendarDays,
  XCircle, CheckCircle, CheckCircle2, AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

/**
 * Tâches ponctuelles : une tâche à faire une seule fois, assignée à un collaborateur précis
 * (ou à un rôle). Elles partagent la table des tâches récurrentes — une ponctuelle est une
 * récurrence de type "once" — pour réutiliser l'assignation et le suivi de complétion déjà en
 * place, mais elles ont leur propre écran pour ne pas se mélanger aux tâches qui reviennent.
 */
interface Completion {
  id: string
  completedBy: string
  completedByName?: string | null
  dueDate: string
  completedAt: string
}

interface PunctualTask {
  id: string
  title: string
  description?: string | null
  startDate: string
  assignedRoleIds: string[]
  assignedUserEmails: string[]
  gymId?: string | null
  isActive: boolean
  createdAt: string
  completions?: Completion[]
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

const todayStr = () => new Date().toISOString().split("T")[0]

function dueLabel(startDate: string): { text: string; tone: "past" | "today" | "future" } {
  const today = todayStr()
  const formatted = new Date(startDate + "T00:00:00").toLocaleDateString("fr-FR")
  if (startDate === today) return { text: "À faire aujourd'hui", tone: "today" }
  if (startDate < today) return { text: `En retard depuis le ${formatted}`, tone: "past" }
  return { text: `À faire le ${formatted}`, tone: "future" }
}

const emptyForm = {
  title: "",
  description: "",
  startDate: todayStr(),
  assignedRoleIds: [] as string[],
  assignedUserEmails: [] as string[],
}

export function PunctualTodoManager() {
  const [tasks, setTasks] = useState<PunctualTask[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterEmployee, setFilterEmployee] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<"all" | "todo" | "done">("all")
  const [showDialog, setShowDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<PunctualTask | null>(null)
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
        fetch("/api/recurring-tasks?admin=true&recurrence=once"),
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

  const openEdit = (task: PunctualTask) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || "",
      startDate: task.startDate,
      assignedRoleIds: Array.isArray(task.assignedRoleIds) ? task.assignedRoleIds : [],
      assignedUserEmails: Array.isArray(task.assignedUserEmails) ? task.assignedUserEmails : [],
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Le titre est obligatoire")
      return
    }
    if (!form.startDate) {
      toast.error("La date d'échéance est obligatoire")
      return
    }
    // Une ponctuelle sans destinataire deviendrait une tâche « pour tout le monde » : c'est
    // exactement ce que cet écran cherche à éviter.
    if (form.assignedRoleIds.length === 0 && form.assignedUserEmails.length === 0) {
      toast.error("Choisissez au moins un collaborateur ou un rôle")
      return
    }

    const payload = {
      title: form.title,
      description: form.description,
      recurrenceType: "once",
      recurrenceInterval: 1,
      startDate: form.startDate,
      excludeWeekends: false,
      assignedRoleIds: form.assignedRoleIds,
      assignedUserEmails: form.assignedUserEmails,
      gymId: null,
    }

    try {
      const url = editingTask ? `/api/recurring-tasks/${editingTask.id}` : "/api/recurring-tasks"
      const res = await fetch(url, {
        method: editingTask ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(editingTask ? "Tâche modifiée" : "Tâche ponctuelle créée")
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

  const toStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

  const filtered = tasks.filter((t) => {
    const userEmails = toStringArray(t.assignedUserEmails)
    const done = (t.completions?.length ?? 0) > 0
    if (filterEmployee !== "all" && !userEmails.includes(filterEmployee)) return false
    if (filterStatus === "todo" && done) return false
    if (filterStatus === "done" && !done) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-red-600 flex-shrink-0" />
            To-Do ponctuelles
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Une tâche à faire une seule fois, assignée à un collaborateur en particulier
          </p>
        </div>
        <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700 text-white gap-2 flex-shrink-0 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Nouvelle
        </Button>
      </div>

      {/* Filtres */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[200px] h-8 text-xs border rounded-lg">
              <SelectValue placeholder="Filtrer par collaborateur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les collaborateurs</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.email}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "todo" | "done")}>
            <SelectTrigger className="w-[160px] h-8 text-xs border rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="todo">À faire</SelectItem>
              <SelectItem value="done">Faites</SelectItem>
            </SelectContent>
          </Select>

          {(filterEmployee !== "all" || filterStatus !== "all") && (
            <button
              onClick={() => { setFilterEmployee("all"); setFilterStatus("all") }}
              className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
            >
              <XCircle className="h-3.5 w-3.5" /> Réinitialiser
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {tasks.length === 0 ? "Aucune tâche ponctuelle" : "Aucun résultat pour ce filtre"}
          </p>
          {tasks.length === 0 && (
            <p className="text-sm mt-1">Créez une tâche à faire une fois pour un collaborateur précis</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const roleIds = toStringArray(task.assignedRoleIds)
            const userEmails = toStringArray(task.assignedUserEmails)
            const completions = task.completions ?? []
            const done = completions.length > 0
            const due = dueLabel(task.startDate)
            return (
              <Card key={task.id} className="border-0 shadow-md bg-white dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-semibold ${done ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}>
                          {task.title}
                        </h3>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          Ponctuelle
                        </span>
                        {done && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Faite
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                      )}
                      {done ? (
                        <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                          {completions
                            .map((c) => `${c.completedByName || c.completedBy} le ${new Date(c.completedAt).toLocaleDateString("fr-FR")}`)
                            .join(", ")}
                        </p>
                      ) : (
                        <p
                          className={`text-xs mt-1 flex items-center gap-1 ${
                            due.tone === "past" ? "text-red-600 font-medium" : "text-gray-400"
                          }`}
                        >
                          {due.tone === "past" ? (
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <CalendarDays className="h-3 w-3 flex-shrink-0" />
                          )}
                          {due.text}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
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
      )}

      {/* Dialog création / édition */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-red-600" />
              {editingTask ? "Modifier la tâche ponctuelle" : "Nouvelle tâche ponctuelle"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Titre <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Ex: Réceptionner la livraison de boissons"
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

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Date d'échéance <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="border-2 rounded-xl"
              />
              <p className="text-xs text-gray-500 mt-1">
                La tâche apparaît à partir de cette date et reste visible tant qu'elle n'est pas faite.
              </p>
            </div>

            {/* Assignation */}
            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-800">
                Assignation <span className="text-xs font-normal text-red-500">(obligatoire)</span>
              </p>

              {employees.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Par collaborateur
                  </label>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 p-2 space-y-1.5">
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
            La tâche ponctuelle sera définitivement supprimée, ainsi que son historique.
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
