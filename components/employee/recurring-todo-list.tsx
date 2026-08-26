"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RefreshCw, CheckCircle2, PartyPopper, CalendarCheck, Lock, XCircle } from "lucide-react"
import { getUserEmail, getUserName } from "@/lib/current-user"
import { toast } from "sonner"

interface RecurringTask {
  id: string
  title: string
  description?: string | null
  recurrenceType: string
  recurrenceInterval: number
  startDate: string
  completedToday: boolean
}

interface RecurringTodoListProps {
  gymId?: string
  roleId?: string | null
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "jour(s)",
  weekly: "semaine(s)",
  monthly: "mois",
}

/** Échéance d'une tâche ponctuelle, avec le retard rendu visible plutôt qu'une simple date. */
function punctualDueLabel(startDate: string): string {
  const today = new Date().toISOString().split("T")[0]
  if (startDate === today) return "À faire aujourd'hui"
  const formatted = new Date(startDate + "T00:00:00").toLocaleDateString("fr-FR")
  return startDate < today ? `En retard depuis le ${formatted}` : `À faire le ${formatted}`
}

export function RecurringTodoList({ gymId, roleId }: RecurringTodoListProps) {
  const [tasks, setTasks] = useState<RecurringTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)
  // Même règle que les tâches de la to-do list de période : on confirme avant de cocher, et une
  // fois validée la tâche est définitive.
  const [taskToValidate, setTaskToValidate] = useState<RecurringTask | null>(null)

  const today = new Date().toISOString().split("T")[0]
  const userEmail = getUserEmail() || ""
  const userName = getUserName() || ""

  useEffect(() => {
    loadTasks()
  }, [gymId, roleId])

  const loadTasks = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ due_today: "true" })
      if (gymId) params.set("gym_id", gymId)
      if (userEmail) params.set("user_email", userEmail)
      // Fallback localStorage si le prop roleId n'est pas encore dispo (race condition)
      const effectiveRoleId = roleId ?? (typeof window !== "undefined" ? localStorage.getItem("userRoleId") : null)
      if (effectiveRoleId) params.set("role_id", effectiveRoleId)

      const res = await fetch(`/api/recurring-tasks?${params}`)
      const json = res.ok ? await res.json() : { data: [] }
      setTasks(Array.isArray(json.data) ? json.data : [])
    } catch {
      // Erreur silencieuse
    } finally {
      setIsLoading(false)
    }
  }

  // Une tâche déjà validée n'est plus cliquable : elle ne peut pas être décochée.
  const requestValidation = (task: RecurringTask) => {
    if (task.completedToday || completing) return
    setTaskToValidate(task)
  }

  const confirmValidation = async () => {
    const task = taskToValidate
    if (!task) return
    setCompleting(task.id)

    try {
      const res = await fetch(`/api/recurring-tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedBy: userEmail, completedByName: userName, dueDate: today }),
      })
      if (!res.ok) throw new Error()
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completedToday: true } : t))
      toast.success(`"${task.title}" validée`)
      setTaskToValidate(null)
    } catch {
      toast.error("Erreur lors de la validation")
    } finally {
      setCompleting(null)
    }
  }

  if (isLoading || tasks.length === 0) return null

  // Une tâche ponctuelle n'a pas de rythme à afficher : elle porte une échéance, et disparaît
  // une fois faite. Les deux familles vivent dans la même table mais ne se lisent pas pareil.
  const punctual = tasks.filter((t) => t.recurrenceType === "once")
  const recurring = tasks.filter((t) => t.recurrenceType !== "once")

  const renderSection = (
    list: RecurringTask[],
    opts: { title: string; Icon: typeof RefreshCw; accent: "blue" | "amber" },
  ) => {
    if (list.length === 0) return null
    const completedCount = list.filter((t) => t.completedToday).length
    const progress = Math.round((completedCount / list.length) * 100)
    const isAmber = opts.accent === "amber"

    return (
      <Card className={isAmber ? "bg-amber-50 border-2 border-amber-200" : "bg-blue-50 border-2 border-blue-200"}>
        <CardContent className="p-6 space-y-4">
          {/* En-tête progression */}
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <opts.Icon className={`h-6 w-6 ${isAmber ? "text-amber-600" : "text-blue-600"}`} /> {opts.title}
            </h3>
            <div className="text-right">
              <div className={`text-2xl font-bold ${isAmber ? "text-amber-600" : "text-blue-600"}`}>
                {completedCount}/{list.length}
              </div>
              <div className="text-sm text-gray-600">
                {completedCount} complétée{completedCount > 1 ? "s" : ""}
              </div>
            </div>
          </div>

          <Progress value={progress} className="h-4" />

          <p className="text-center text-gray-600 flex items-center justify-center gap-2 text-sm">
            {progress === 100 ? (
              <><PartyPopper className="h-5 w-5 text-green-600" /> Tout est terminé !</>
            ) : (
              `${progress}% terminé`
            )}
          </p>

          {/* Liste des tâches */}
          <div className="space-y-2">
            {list.map((task) => (
              <div
                key={task.id}
                onClick={() => requestValidation(task)}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  task.completedToday
                    ? "bg-green-50 border-green-200 opacity-80 cursor-default"
                    : isAmber
                      ? "bg-white border-amber-100 hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer"
                      : "bg-white border-blue-100 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer"
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {task.completedToday ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => {}}
                      className="pointer-events-none"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.completedToday ? "line-through text-gray-400" : "text-gray-800"}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {task.completedToday
                      ? "Validée — non modifiable"
                      : task.recurrenceType === "once"
                        ? punctualDueLabel(task.startDate)
                        : `Tous les ${task.recurrenceInterval} ${RECURRENCE_LABELS[task.recurrenceType]}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {renderSection(punctual, { title: "Tâches ponctuelles", Icon: CalendarCheck, accent: "amber" })}
      {renderSection(recurring, { title: "Tâches récurrentes", Icon: RefreshCw, accent: "blue" })}

      {/* Dialog de confirmation — même règle que la to-do list de période */}
      <Dialog
        open={!!taskToValidate}
        onOpenChange={(open) => { if (!open && !completing) setTaskToValidate(null) }}
      >
        <DialogContent className="sm:max-w-md bg-white" aria-describedby="recurring-validation-description">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <Lock className="h-6 w-6 text-red-600" />
              <span>Valider la tâche</span>
            </DialogTitle>
            <DialogDescription id="recurring-validation-description" className="text-base text-gray-600">
              Confirmez la validation de cette tâche
            </DialogDescription>
          </DialogHeader>
          <div className="text-base text-gray-600 mb-4">
            {taskToValidate && (
              <>
                Voulez-vous valider la tâche <strong>&quot;{taskToValidate.title}&quot;</strong> ?
                <br />
                <span className="text-red-600 font-medium">
                  Une fois validée, vous ne pourrez plus la décocher.
                </span>
              </>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setTaskToValidate(null)}
              disabled={!!completing}
              className="text-sm sm:text-lg px-4 sm:px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-2 w-full sm:w-auto"
            >
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5" /> Annuler
            </Button>
            <Button
              onClick={confirmValidation}
              disabled={!!completing}
              className="bg-red-600 hover:bg-red-700 text-sm sm:text-lg px-4 sm:px-6 w-full sm:w-auto"
            >
              <Lock className="mr-2 h-4 w-4" />
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
