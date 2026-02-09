"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Clock, CheckCircle, Coffee, Loader2 } from "lucide-react"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"

interface EmployeeStatus {
  id: string
  name: string
  email: string
  currentPeriod: "matin" | "aprem" | "journee" | null
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
      // Charger tous les utilisateurs avec rôle employee
      const responseEmployees = await fetch('/api/db/users')
      if (!responseEmployees.ok) {
        console.error('Erreur chargement employés:', responseEmployees.status)
        setEmployeeStatuses([])
        setIsLoading(false)
        return
      }
      
      const employeesData = await responseEmployees.json()
      const allUsers = employeesData.data || []
      
      // Filtrer pour garder uniquement les employés actifs
      const employees = allUsers.filter((u: any) => u.role === 'employee' && u.active === true)

      if (employees.length === 0) {
        setEmployeeStatuses([])
        setIsLoading(false)
        return
      }

      // Charger les données de chaque employé
      const today = new Date().toISOString().split('T')[0]
      
      const statusPromises = employees.map(async (emp: any) => {
        // Charger le planning du jour
        const responseSchedule = await fetch(`/api/db/work_schedules?user_id=${emp.id}&work_date=${today}&single=true`)
        let schedule = null
        if (responseSchedule.ok) {
          const scheduleData = await responseSchedule.json()
          schedule = scheduleData.data
        }

        // Charger les tâches de l'employé
        const responseTasks = await fetch(`/api/db/tasks?user_id=${emp.id}`)
        let tasks = []
        if (responseTasks.ok) {
          const tasksData = await responseTasks.json()
          tasks = tasksData.data || []
        }

        // Filtrer les tâches selon la période
        let periodTasks = tasks
        if (schedule?.type === 'work') {
          // Déterminer la période depuis le localStorage de l'employé (simulation)
          // En production, vous devriez stocker ça dans la DB
          const period = localStorage.getItem(`employee_${emp.id}_period`) as "matin" | "aprem" | "journee" | null
          
          if (period === 'matin') {
            periodTasks = tasks.filter((t: any) => !t.period || t.period === 'matin' || t.period === 'journee')
          } else if (period === 'aprem') {
            periodTasks = tasks.filter((t: any) => !t.period || t.period === 'aprem' || t.period === 'journee')
          }
        }

        const completedTasks = periodTasks.filter((t: any) => t.status === 'completed').length
        const totalTasks = periodTasks.length

        // Déterminer si en pause (type = 'break' dans work_schedules)
        const isOnBreak = schedule?.type === 'break'

        return {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          currentPeriod: schedule?.type === 'work' ? (localStorage.getItem(`employee_${emp.id}_period`) as "matin" | "aprem" | "journee" | null) : null,
          tasksCompleted: completedTasks,
          totalTasks: totalTasks,
          isOnBreak: isOnBreak,
          breakStartTime: isOnBreak && schedule?.start_time ? schedule.start_time : undefined,
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

  const getPeriodLabel = (period: string | null) => {
    if (!period) return "Non démarré"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Suivi Temps Réel</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
          <Clock className="h-4 w-4" />
          <span>Dernière mise à jour : {new Date().toLocaleTimeString("fr-FR")}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-300" />
          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Chargement des données...</span>
        </div>
      ) : employeeStatuses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucun employé actif pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {employeeStatuses.map((employee) => (
          <Card key={employee.id} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">{employee.name}</CardTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{employee.email}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="border-red-200 text-red-700">
                    {getPeriodLabel(employee.currentPeriod)}
                  </Badge>
                  {employee.isOnBreak && (
                    <Badge variant="secondary" className="flex items-center space-x-1 bg-red-50 text-red-700">
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
                  <span className="text-gray-600 dark:text-gray-300">Progression des tâches</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {employee.tasksCompleted}/{employee.totalTasks}
                  </span>
                </div>
                {employee.totalTasks > 0 ? (
                  <Progress value={(employee.tasksCompleted / employee.totalTasks) * 100} className="h-2" />
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-400 italic">Aucune tâche assignée</div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center space-x-4">
                  {employee.isOnBreak ? (
                    <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                      <Coffee className="h-4 w-4" />
                      <span>Pause depuis {employee.breakStartTime}</span>
                    </div>
                  ) : employee.currentPeriod ? (
                    <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>En activité</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>Pas encore commencé</span>
                    </div>
                  )}
                </div>
                <span>Dernière activité : {employee.lastUpdate}</span>
              </div>

              {employee.totalTasks > 0 && employee.tasksCompleted === employee.totalTasks && (
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-2 rounded border border-green-200">
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
        <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Statistiques du jour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {employeeStatuses.reduce((sum, emp) => sum + emp.totalTasks, 0) > 0
                    ? Math.round((employeeStatuses.reduce((sum, emp) => sum + emp.tasksCompleted, 0) / 
                      employeeStatuses.reduce((sum, emp) => sum + emp.totalTasks, 0)) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Tâches complétées</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {employeeStatuses.filter(emp => !emp.isOnBreak && emp.currentPeriod).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Employés actifs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {employeeStatuses.filter(emp => emp.isOnBreak).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">En pause</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
