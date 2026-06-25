"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, CheckCircle2, PartyPopper } from "lucide-react"
import { getUserEmail, getUserName } from "@/lib/current-user"
import { toast } from "sonner"

interface RecurringTask {
  id: string
  title: string
  description?: string | null
  recurrenceType: string
  recurrenceInterval: number
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

export function RecurringTodoList({ gymId, roleId }: RecurringTodoListProps) {
  const [tasks, setTasks] = useState<RecurringTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

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

  const toggleTask = async (task: RecurringTask) => {
    if (completing === task.id) return
    setCompleting(task.id)

    try {
      if (!task.completedToday) {
        const res = await fetch(`/api/recurring-tasks/${task.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completedBy: userEmail, completedByName: userName, dueDate: today }),
        })
        if (!res.ok) throw new Error()
        setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completedToday: true } : t))
        toast.success(`"${task.title}" complétée`)
      } else {
        const res = await fetch(
          `/api/recurring-tasks/${task.id}/complete?completed_by=${encodeURIComponent(userEmail)}&due_date=${today}`,
          { method: "DELETE" }
        )
        if (!res.ok) throw new Error()
        setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completedToday: false } : t))
        toast.info(`"${task.title}" décochée`)
      }
    } catch {
      toast.error("Erreur lors de la mise à jour")
    } finally {
      setCompleting(null)
    }
  }

  if (isLoading || tasks.length === 0) return null

  const completedCount = tasks.filter((t) => t.completedToday).length
  const progress = Math.round((completedCount / tasks.length) * 100)

  return (
    <Card className="bg-blue-50 border-2 border-blue-200">
      <CardContent className="p-6 space-y-4">
        {/* En-tête progression */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-blue-600" /> Tâches récurrentes
          </h3>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {completedCount}/{tasks.length}
            </div>
            <div className="text-sm text-gray-600">
              {completedCount} complétée{completedCount > 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <Progress value={progress} className="h-4" />

        <p className="text-center text-gray-600 flex items-center justify-center gap-2 text-sm">
          {progress === 100 ? (
            <><PartyPopper className="h-5 w-5 text-green-600" /> Toutes les tâches récurrentes terminées !</>
          ) : (
            `${progress}% terminé`
          )}
        </p>

        {/* Liste des tâches */}
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task)}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                task.completedToday
                  ? "bg-green-50 border-green-200 opacity-80"
                  : "bg-white border-blue-100 hover:border-blue-300 hover:bg-blue-50/50"
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
                  Tous les {task.recurrenceInterval} {RECURRENCE_LABELS[task.recurrenceType]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
