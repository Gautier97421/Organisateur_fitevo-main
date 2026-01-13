"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Clock, CheckCircle, Coffee, Loader2 } from "lucide-react"
import { supabase } from "@/lib/api-client"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"

interface EmployeeStatus {
  id: string
  name: string
  currentPeriod: "matin" | "aprem" | "journee"
  tasksCompleted: number
  totalTasks: number
  isOnBreak: boolean
  breakStartTime?: string
  lastUpdate: string
}

export function RealTimeMonitor() {
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadEmployeeData = async () => {
    try {
      // Charger tous les employés actifs
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)

      if (empError) throw empError

      if (!employees || employees.length === 0) {
        setEmployeeStatuses([])
        setIsLoading(false)
        return
      }

      // Charger les tâches de chaque employé pour aujourd'hui
      const today = new Date().toISOString().split('T')[0]
      const statusPromises = employees.map(async (emp) => {
        // Charger les tâches de l'employé
        const { data: tasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", emp.id)

        // Charger les pauses de l'employé pour aujourd'hui
        const { data: breaks } = await supabase
          .from("work_schedules")
          .select("*")
          .eq("user_id", emp.id)
          .eq("work_date", today)
          .single()

        const completedTasks = tasks?.filter(t => t.is_completed).length || 0
        const totalTasks = tasks?.length || 0

        // Déterminer si l'employé est en pause (basé sur le schedule)
        const isOnBreak = breaks?.period === "matin" || breaks?.period === "aprem" ? false : false

        return {
          id: emp.id,
          name: emp.name,
          currentPeriod: (breaks?.period as "matin" | "aprem" | "journee") || "journee",
          tasksCompleted: completedTasks,
          totalTasks: totalTasks,
          isOnBreak: isOnBreak,
          lastUpdate: new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }
      })

      const statuses = await Promise.all(statusPromises)
      setEmployeeStatuses(statuses)
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEmployeeData()
  }, [])

  // Rafraîchissement automatique toutes les 30 secondes
  useAutoRefresh(loadEmployeeData, 30000)

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "matin":
        return "Matin"
      case "aprem":
        return "Après-midi"
      case "journee":
        return "Journée entière"
      default:
        return period
    }
  }

  const getProgressColor = (completed: number, total: number) => {
    const percentage = (completed / total) * 100
    if (percentage >= 80) return "bg-green-500"
    if (percentage >= 50) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Suivi Temps Réel</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span>Dernière mise à jour : {new Date().toLocaleTimeString("fr-FR")}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-3 text-sm text-gray-500">Chargement des données...</span>
        </div>
      ) : employeeStatuses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm text-gray-500">Aucun employé actif pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {employeeStatuses.map((employee) => (
          <Card key={employee.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{employee.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{getPeriodLabel(employee.currentPeriod)}</Badge>
                  {employee.isOnBreak && (
                    <Badge variant="secondary" className="flex items-center space-x-1">
                      <Coffee className="h-3 w-3" />
                      <span>En pause</span>
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progression des tâches</span>
                  <span>
                    {employee.tasksCompleted}/{employee.totalTasks}
                  </span>
                </div>
                <Progress value={(employee.tasksCompleted / employee.totalTasks) * 100} className="h-2" />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center space-x-4">
                  {employee.isOnBreak ? (
                    <div className="flex items-center space-x-1 text-orange-600">
                      <Coffee className="h-4 w-4" />
                      <span>Pause depuis {employee.breakStartTime}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>En activité</span>
                    </div>
                  )}
                </div>
                <span>Dernière activité : {employee.lastUpdate}</span>
              </div>

              {employee.tasksCompleted === employee.totalTasks && (
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-2 rounded">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Toutes les tâches terminées !</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {!isLoading && employeeStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistiques du jour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {Math.round((employeeStatuses.reduce((sum, emp) => sum + emp.tasksCompleted, 0) / 
                    Math.max(1, employeeStatuses.reduce((sum, emp) => sum + emp.totalTasks, 0))) * 100)}%
                </div>
                <div className="text-sm text-gray-600">Tâches complétées</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {employeeStatuses.filter(emp => !emp.isOnBreak).length}
                </div>
                <div className="text-sm text-gray-600">Employés actifs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {employeeStatuses.filter(emp => emp.isOnBreak).length}
                </div>
                <div className="text-sm text-gray-600">En pause</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
