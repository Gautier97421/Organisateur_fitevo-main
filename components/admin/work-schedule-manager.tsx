"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, User, AlertTriangle, CheckCircle, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/api-client"

interface WorkSchedule {
  id: string
  employee_email: string
  employee_name: string
  work_date: string
  start_time: string
  end_time: string
  break_duration?: number
  break_start_time?: string
  status: "scheduled" | "confirmed" | "completed"
  created_at: string
}

interface Employee {
  email: string
  name: string
  color: string
}

export function WorkScheduleManager() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [conflicts, setConflicts] = useState<string[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<WorkSchedule | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const employeeColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-red-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-teal-500",
  ]

  useEffect(() => {
    loadData()
  }, [currentDate])

  const loadData = async () => {
    try {
      await Promise.all([loadSchedules(), loadEmployees()])
    } finally {
      setIsLoading(false)
    }
  }

  const loadSchedules = async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from("work_schedules")
        .select("*")
        .gte("work_date", startOfMonth.toISOString().split("T")[0])
        .lte("work_date", endOfMonth.toISOString().split("T")[0])
        .order("work_date", { ascending: true })

      if (error) throw error
      setSchedules(data || [])
      detectConflicts(data || [])
    } catch (error) {
      // Erreur silencieuse
    }
  }

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase.from("employees").select("email, name").eq("is_active", true)

      if (error) throw error

      const employeesWithColors = (data || []).map((emp, index) => ({
        ...emp,
        color: employeeColors[index % employeeColors.length],
      }))

      setEmployees(employeesWithColors)
    } catch (error) {
      // Erreur silencieuse
    }
  }

  const detectConflicts = (schedules: WorkSchedule[]) => {
    const conflictDates: string[] = []

    // Grouper par date
    const schedulesByDate = schedules.reduce(
      (acc, schedule) => {
        if (!acc[schedule.work_date]) {
          acc[schedule.work_date] = []
        }
        acc[schedule.work_date].push(schedule)
        return acc
      },
      {} as Record<string, WorkSchedule[]>,
    )

    // Vérifier les conflits pour chaque date
    Object.entries(schedulesByDate).forEach(([date, daySchedules]) => {
      for (let i = 0; i < daySchedules.length; i++) {
        for (let j = i + 1; j < daySchedules.length; j++) {
          const schedule1 = daySchedules[i]
          const schedule2 = daySchedules[j]

          // Vérifier si les horaires se chevauchent
          const start1 = new Date(`2000-01-01T${schedule1.start_time}`)
          const end1 = new Date(`2000-01-01T${schedule1.end_time}`)
          const start2 = new Date(`2000-01-01T${schedule2.start_time}`)
          const end2 = new Date(`2000-01-01T${schedule2.end_time}`)

          if (start1 < end2 && end1 > start2) {
            if (!conflictDates.includes(date)) {
              conflictDates.push(date)
            }
          }
        }
      }
    })

    setConflicts(conflictDates)
  }

  const updateScheduleStatus = async (scheduleId: string, newStatus: "confirmed" | "completed") => {
    try {
      const { error } = await supabase.from("work_schedules").update({ status: newStatus }).eq("id", scheduleId)

      if (error) throw error

      setSchedules(schedules.map((s) => (s.id === scheduleId ? { ...s, status: newStatus } : s)))

      alert(`Statut mis à jour : ${newStatus === "confirmed" ? "Confirmé" : "Terminé"}`)
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
      alert("Erreur lors de la mise à jour")
    }
  }

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce planning ?")) return

    try {
      const { error } = await supabase.from("work_schedules").delete().eq("id", scheduleId)

      if (error) throw error

      setSchedules(schedules.filter((s) => s.id !== scheduleId))
      setShowDetailsDialog(false)
      alert("Planning supprimé")
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
      alert("Erreur lors de la suppression")
    }
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    // Jours du mois précédent
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      days.push({ date: prevDate, isCurrentMonth: false })
    }

    // Jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push({ date, isCurrentMonth: true })
    }

    // Jours du mois suivant
    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day)
      days.push({ date: nextDate, isCurrentMonth: false })
    }

    return days
  }

  const getSchedulesForDate = (date: Date) => {
    const dateString = date.toISOString().split("T")[0]
    return schedules.filter((schedule) => schedule.work_date === dateString)
  }

  const getEmployeeColor = (employeeEmail: string) => {
    const employee = employees.find((emp) => emp.email === employeeEmail)
    return employee?.color || "bg-gray-500"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "border-l-green-500 dark:border-l-green-400"
      case "completed":
        return "border-l-blue-500 dark:border-l-blue-400"
      default:
        return "border-l-yellow-500 dark:border-l-yellow-400"
    }
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + (direction === "next" ? 1 : -1), 1))
  }

  const monthNames = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ]

  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-lg text-gray-900 dark:text-gray-100">Chargement des plannings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">
          📅 Gestion des Plannings
        </h2>
        {conflicts.length > 0 && (
          <Badge className="bg-red-100 text-red-800 text-lg px-4 py-2">
            <AlertTriangle className="h-4 w-4 mr-1" />
            {conflicts.length} conflit{conflicts.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Navigation du calendrier */}
      <Card className="border-0 shadow-xl bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => navigateMonth("prev")}
              className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-2xl font-bold text-gray-900">
              Planning - {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <Button
              variant="outline"
              onClick={() => navigateMonth("next")}
              className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* En-têtes des jours */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {dayNames.map((day) => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Grille du calendrier */}
          <div className="grid grid-cols-7 gap-2">
            {getDaysInMonth().map((dayInfo, index) => {
              const daySchedules = getSchedulesForDate(dayInfo.date)
              const isToday = dayInfo.date.toDateString() === new Date().toDateString() && dayInfo.isCurrentMonth
              const hasConflict = conflicts.includes(dayInfo.date.toISOString().split("T")[0])

              return (
                <div
                  key={index}
                  className={`
                    min-h-[120px] p-2 border rounded-xl transition-all duration-200
                    ${
                      dayInfo.isCurrentMonth
                        ? "bg-white"
                        : "bg-gray-50 text-gray-400"
                    }
                    ${
                      isToday
                        ? "border-red-600 bg-red-50"
                        : "border-gray-200"
                    }
                    ${hasConflict ? "border-red-600 bg-red-50" : ""}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm text-gray-900">
                      {dayInfo.date.getDate()}
                    </div>
                    {hasConflict && <AlertTriangle className="h-3 w-3 text-red-600" />}
                  </div>
                  <div className="space-y-1">
                    {daySchedules.slice(0, 3).map((schedule) => (
                      <div
                        key={schedule.id}
                        onClick={() => {
                          setSelectedSchedule(schedule)
                          setShowDetailsDialog(true)
                        }}
                        className={`text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 ${getEmployeeColor(schedule.employee_email)}`}
                        title={`${schedule.employee_name}: ${schedule.start_time} - ${schedule.end_time} (${schedule.status})`}
                      >
                        {schedule.employee_name.split(" ")[0]} {schedule.start_time}-{schedule.end_time}
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{daySchedules.length - 3} autre(s)
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Légende des employés */}
      <Card className="border-0 shadow-xl bg-white">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3 text-gray-900">Légende des employés :</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {employees.map((employee) => (
              <div key={employee.email} className="flex items-center space-x-2">
                <div className={`w-4 h-4 ${employee.color} rounded`}></div>
                <span className="text-sm text-gray-700">{employee.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Légende des statuts */}
      <Card className="border-0 shadow-xl bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span className="text-gray-700">Programmé</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-600 rounded"></div>
              <span className="text-gray-700">Confirmé</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-600 rounded"></div>
              <span className="text-gray-700">Terminé</span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-gray-700">Conflit d'horaires</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de détails */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <User className="h-6 w-6 text-red-600" />
              <span>Détails du Planning</span>
            </DialogTitle>
            {selectedSchedule && (
              <DialogDescription className="text-lg text-gray-600">
                <div className="space-y-2 mt-4">
                  <p>
                    <strong>Employé :</strong> {selectedSchedule.employee_name}
                  </p>
                  <p>
                    <strong>Date :</strong> {new Date(selectedSchedule.work_date).toLocaleDateString("fr-FR")}
                  </p>
                  <p>
                    <strong>Horaires :</strong> {selectedSchedule.start_time} - {selectedSchedule.end_time}
                  </p>
                  <p>
                    <strong>Pause :</strong> {selectedSchedule.break_duration} min
                    {selectedSchedule.break_start_time && ` à ${selectedSchedule.break_start_time}`}
                  </p>
                  <p>
                    <strong>Statut :</strong>
                    <Badge
                      className={`ml-2 ${
                        selectedSchedule.status === "confirmed"
                          ? "bg-green-100 text-green-800"
                          : selectedSchedule.status === "completed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selectedSchedule.status === "confirmed"
                        ? "Confirmé"
                        : selectedSchedule.status === "completed"
                          ? "Terminé"
                          : "Programmé"}
                    </Badge>
                  </p>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDetailsDialog(false)}
              className="text-lg px-6 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Fermer
            </Button>
            {selectedSchedule && selectedSchedule.status === "scheduled" && (
              <Button
                onClick={() => updateScheduleStatus(selectedSchedule.id, "confirmed")}
                className="bg-green-600 hover:bg-green-700 text-white text-lg px-6 flex items-center gap-2"
              >
                <CheckCircle className="h-5 w-5" /> Confirmer
              </Button>
            )}
            {selectedSchedule && selectedSchedule.status === "confirmed" && (
              <Button
                onClick={() => updateScheduleStatus(selectedSchedule.id, "completed")}
                className="bg-red-600 hover:bg-red-700 text-white text-lg px-6 flex items-center gap-2"
              >
                <CheckCircle className="h-5 w-5" /> Marquer terminé
              </Button>
            )}
            {selectedSchedule && (
              <Button
                onClick={() => deleteSchedule(selectedSchedule.id)}
                variant="outline"
                className="border-2 border-red-600 text-red-600 hover:bg-red-50 bg-white text-lg px-6 flex items-center gap-2"
              >
                <Trash2 className="h-5 w-5" /> Supprimer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
