"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, User, AlertTriangle, CheckCircle, Trash2, CalendarDays, Plus, XCircle, Clock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  role?: string
}

export function WorkScheduleManager() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [conflicts, setConflicts] = useState<string[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<WorkSchedule | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showDayDetailsDialog, setShowDayDetailsDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState<string>("")
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null)
  const [newSchedule, setNewSchedule] = useState({
    start_time: "",
    end_time: "",
    break_duration: 0,
    break_start_time: ""
  })

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
    const role = localStorage.getItem("userRole") || ""
    setCurrentUserRole(role)
    loadData()
  }, [currentDate])

  const loadData = async () => {
    try {
      await Promise.all([loadSchedules(), loadEmployees()])
    } finally {
      setIsLoading(false)
    }
  }

  const filterSchedulesForAdmin = async (schedules: WorkSchedule[]) => {
    try {
      // Récupérer les infos de tous les utilisateurs pour connaître leur rôle
      const response = await fetch("/api/db/users")
      if (response.ok) {
        const result = await response.json()
        const users = result.data || []
        
        // Créer un map email -> rôle
        const userRoles = new Map<string, string>()
        users.forEach((user: any) => {
          userRoles.set(user.email, user.role)
        })
        
        // Filtrer pour garder les plannings des employés ET des admins
        return schedules.filter(schedule => {
          const role = userRoles.get(schedule.employee_email)
          return role === 'employee' || role === 'admin'
        })
      }
      return schedules
    } catch (error) {
      console.error("Erreur lors du filtrage des plannings:", error)
      return schedules
    }
  }

  const loadSchedules = async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const startDate = startOfMonth.toISOString().split("T")[0]
      const endDate = endOfMonth.toISOString().split("T")[0]

      const response = await fetch(`/api/db/work_schedules?work_date_gte=${startDate}&work_date_lte=${endDate}`)
      
      if (response.ok) {
        const result = await response.json()
        let data = result.data || []
        console.log(`[WorkScheduleManager] Chargé ${data.length} schedules pour ${startDate} à ${endDate}`)
        if (data.length > 0) {
          console.log('[WorkScheduleManager] Premier schedule (JSON):', JSON.stringify(data[0], null, 2))
          console.log('[WorkScheduleManager] employee_name:', data[0].employee_name)
          console.log('[WorkScheduleManager] employeeName:', data[0].employeeName)
        }
        
        // Filtrer selon le rôle
        const userRole = localStorage.getItem("userRole") || ""
        if (userRole === "admin") {
          // Les admins ne voient que les plannings des employés
          data = await filterSchedulesForAdmin(data)
        }
        // Les superadmins voient tous les plannings
        
        setSchedules(data)
        detectConflicts(data)
      } else {
        console.error('[WorkScheduleManager] Erreur réponse API:', response.status)
        setSchedules([])
      }
    } catch (error) {
      console.error("[WorkScheduleManager] Erreur lors du chargement des horaires:", error)
      setSchedules([])
    }
  }

  const loadEmployees = async () => {
    try {
      // Charger les employés et les admins
      const response = await fetch("/api/db/users?is_active=true")

      if (response.ok) {
        const result = await response.json()
        const data = result.data || []
        
        // Filtrer selon le rôle de l'utilisateur actuel
        const userRole = localStorage.getItem("userRole") || ""
        let filteredData = data
        
        if (userRole === "admin") {
          // Les admins voient les employés ET les autres admins
          filteredData = data.filter((user: any) => 
            user.role === 'employee' || user.role === 'admin'
          )
        } else if (userRole === "superadmin") {
          // Les superadmins voient les employés et les admins
          filteredData = data.filter((user: any) => 
            user.role === 'employee' || user.role === 'admin'
          )
        }
        
        const employeesWithColors = filteredData.map((emp: any, index: number) => ({
          email: emp.email,
          name: emp.name,
          role: emp.role,
          color: employeeColors[index % employeeColors.length],
        }))

        setEmployees(employeesWithColors)
      } else {
        setEmployees([])
      }
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs:", error)
      setEmployees([])
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
      const response = await fetch(`/api/db/work_schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Erreur API:', error)
        throw new Error(error.error || "Erreur lors de la mise à jour")
      }

      // Recharger les schedules depuis le serveur
      await loadSchedules()
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
    }
  }

  const confirmDeleteSchedule = (scheduleId: string) => {
    setScheduleToDelete(scheduleId)
    setShowDeleteConfirmDialog(true)
  }

  const deleteSchedule = async () => {
    if (!scheduleToDelete) return

    try {
      const response = await fetch(`/api/db/work_schedules/${scheduleToDelete}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error("Erreur lors de la suppression")

      // Recharger les schedules depuis le serveur
      await loadSchedules()
      setShowDetailsDialog(false)
      setShowDeleteConfirmDialog(false)
      setScheduleToDelete(null)
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
      setShowDeleteConfirmDialog(false)
      setScheduleToDelete(null)
    }
  }

  const handleAddClick = (date: Date) => {
    setSelectedDate(date)
    setAttemptedSubmit(false)
    setSelectedEmployeeEmail("")
    setNewSchedule({
      start_time: "",
      end_time: "",
      break_duration: 0,
      break_start_time: ""
    })
    setShowAddDialog(true)
  }

  const addSchedule = async () => {
    setAttemptedSubmit(true)

    if (!selectedDate || !selectedEmployeeEmail || !newSchedule.start_time || !newSchedule.end_time) {
      console.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    try {
      const scheduleData = {
        employee_email: selectedEmployeeEmail,
        work_date: selectedDate.toISOString().split("T")[0],
        start_time: newSchedule.start_time,
        end_time: newSchedule.end_time,
        break_duration: newSchedule.break_duration || 0,
        break_start_time: newSchedule.break_start_time || null,
        status: "scheduled"
      }

      const response = await fetch("/api/db/work_schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData)
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Erreur API:", error)
        throw new Error(error.error || "Erreur lors de la création")
      }

      await loadSchedules()
      setShowAddDialog(false)
      setSelectedDate(null)
      setSelectedEmployeeEmail("")
      setAttemptedSubmit(false)
      setNewSchedule({
        start_time: "",
        end_time: "",
        break_duration: 0,
        break_start_time: ""
      })
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error)
    }
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    // getDay() retourne 0 pour dimanche, on ajuste pour que lundi soit 0
    let startingDayOfWeek = firstDay.getDay() - 1
    if (startingDayOfWeek === -1) startingDayOfWeek = 6 // Si dimanche, le mettre à la fin

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
    const filtered = schedules.filter((schedule) => {
      // Vérifier que work_date existe
      if (!schedule.work_date) {
        console.warn('[WorkScheduleManager] work_date manquant pour le schedule:', schedule.id)
        return false
      }
      
      // Normaliser work_date au format YYYY-MM-DD
      let scheduleDate: string
      const workDate = schedule.work_date as any
      
      if (typeof workDate === 'string') {
        // Si c'est une string ISO "2026-02-10T00:00:00.000Z" ou "2026-02-10"
        scheduleDate = workDate.split("T")[0]
      } else if (workDate && typeof workDate === 'object' && workDate.toISOString) {
        // Si c'est un objet Date
        scheduleDate = workDate.toISOString().split("T")[0]
      } else {
        console.warn('[WorkScheduleManager] Format work_date inconnu:', workDate, 'pour schedule:', schedule.id)
        return false
      }
      
      const matches = scheduleDate === dateString
      return matches
    })
    
    return filtered
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

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-lg text-gray-900 dark:text-gray-100">Chargement des plannings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CalendarDays className="w-7 h-7 md:w-8 md:h-8 text-red-600" />
          Gestion des Plannings
        </h2>
        {conflicts.length > 0 && (
          <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-lg px-4 py-2">
            <AlertTriangle className="h-4 w-4 mr-1" />
            {conflicts.length} conflit{conflicts.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Navigation du calendrier */}
      <Card className="border-0 shadow-xl bg-white dark:bg-gray-800">
        <CardHeader className="pb-4 px-3 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => navigateMonth("prev")}
              className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 px-2 md:px-4"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white text-center">
              Planning - {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <Button
              variant="outline"
              onClick={() => navigateMonth("next")}
              className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 px-2 md:px-4"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          {/* En-têtes des jours */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 md:mb-4">
            {dayNames.map((day) => (
              <div key={day} className="text-center font-semibold text-gray-600 dark:text-gray-300 py-1 md:py-2 text-xs sm:text-sm">
                {day}
              </div>
            ))}
          </div>

          {/* Grille du calendrier */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {getDaysInMonth().map((dayInfo, index) => {
              const daySchedules = getSchedulesForDate(dayInfo.date)
              const isToday = dayInfo.date.toDateString() === new Date().toDateString() && dayInfo.isCurrentMonth
              const hasConflict = conflicts.includes(dayInfo.date.toISOString().split("T")[0])

              return (
                <div
                  key={index}
                  onClick={() => {
                    if (dayInfo.isCurrentMonth) {
                      setSelectedDate(dayInfo.date)
                      setShowDayDetailsDialog(true)
                    }
                  }}
                  className={`
                    min-h-[80px] sm:min-h-[100px] md:min-h-[120px] p-1 md:p-2 border rounded-lg md:rounded-xl transition-all duration-200 cursor-pointer hover:shadow-lg
                    ${
                      dayInfo.isCurrentMonth
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600"
                    }
                    ${
                      isToday
                        ? "border-red-600 bg-red-50 dark:bg-red-900/20"
                        : "border-gray-200 dark:border-gray-700"
                    }
                    ${hasConflict ? "border-red-600 bg-red-50 dark:bg-red-900/20" : ""}
                  `}
                >
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white">
                        {dayInfo.date.getDate()}
                      </div>
                      {hasConflict && <AlertTriangle className="h-3 w-3 text-red-600" />}
                    </div>
                    {dayInfo.isCurrentMonth && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddClick(dayInfo.date)
                        }}
                        className="absolute bottom-1 right-1 p-0.5 bg-gray-600 hover:bg-gray-500 text-white rounded-full shadow-lg transition-all hover:scale-110"
                        title="Ajouter un planning"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {daySchedules.slice(0, 3).map((schedule) => {
                      const scheduleData = schedule as any
                      const employeeName = scheduleData.employee_name || 'Employé'
                      const startTime = scheduleData.start_time || ''
                      const endTime = scheduleData.end_time || ''
                      const employeeEmail = scheduleData.employee_email || ''
                      
                      return (
                        <div
                          key={schedule.id}
                          className={`text-[10px] sm:text-xs p-1 rounded text-white truncate ${getEmployeeColor(employeeEmail)}`}
                          title={`${employeeName}: ${startTime} - ${endTime} (${schedule.status})`}
                        >
                          <span className="hidden sm:inline">{employeeName.split(" ")[0]} </span>{startTime}-{endTime}
                        </div>
                      )
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
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
      <Card className="border-0 shadow-xl bg-white dark:bg-gray-800">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">Légende des employés :</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {employees.map((employee) => (
              <div key={employee.email} className="flex items-center space-x-2">
                <div className={`w-4 h-4 ${employee.color} rounded`}></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{employee.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Légende des statuts */}
      <Card className="border-0 shadow-xl bg-white dark:bg-gray-800">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Programmé</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-600 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Confirmé</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-600 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Terminé</span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-gray-700 dark:text-gray-300">Conflit d'horaires</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de détails */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900 dark:text-white">
              <User className="h-6 w-6 text-red-600 dark:text-red-400" />
              <span>Détails du Planning</span>
            </DialogTitle>
            {selectedSchedule && (
              <DialogDescription className="text-lg text-gray-600 dark:text-gray-300">
                <div className="space-y-2 mt-4">
                  <p>
                    <strong>Employé :</strong> {(selectedSchedule as any).employee_name || 'N/A'}
                  </p>
                  <p>
                    <strong>Date :</strong> {new Date(selectedSchedule.work_date).toLocaleDateString("fr-FR")}
                  </p>
                  <p>
                    <strong>Horaires :</strong> {(selectedSchedule as any).start_time || 'N/A'} - {(selectedSchedule as any).end_time || 'N/A'}
                  </p>
                  <p>
                    <strong>Pause :</strong> {(selectedSchedule as any).break_duration || 0} min
                    {(selectedSchedule as any).break_start_time && ` à ${(selectedSchedule as any).break_start_time}`}
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
            {selectedSchedule && (
              <Button
                onClick={() => confirmDeleteSchedule(selectedSchedule.id)}
                variant="outline"
                className="border-2 border-red-600 text-red-600 hover:bg-red-50 bg-white text-lg px-6 flex items-center gap-2"
              >
                <Trash2 className="h-5 w-5" /> Supprimer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'ajout de planning */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center space-x-2 text-gray-900 dark:text-white">
              <CalendarDays className="h-6 w-6 text-red-600 dark:text-red-400" />
              <span>Ajouter un planning</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              {selectedDate && selectedDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Employé <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedEmployeeEmail}
                onChange={(e) => setSelectedEmployeeEmail(e.target.value)}
                className={`w-full border-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 ${
                  attemptedSubmit && !selectedEmployeeEmail ? "border-red-500 focus:border-red-600" : "border-gray-300 dark:border-gray-600"
                }`}
              >
                <option value="">Sélectionner un employé</option>
                {employees.map((employee) => (
                  <option key={employee.email} value={employee.email}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Heure de début <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={newSchedule.start_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                  className={`border-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    attemptedSubmit && !newSchedule.start_time ? "border-red-500 focus:border-red-600" : ""
                  }`}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Heure de fin <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={newSchedule.end_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                  className={`border-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    attemptedSubmit && !newSchedule.end_time ? "border-red-500 focus:border-red-600" : ""
                  }`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Pause (minutes)
                </label>
                <Input
                  type="number"
                  value={newSchedule.break_duration || ""}
                  onChange={(e) => setNewSchedule({ ...newSchedule, break_duration: parseInt(e.target.value) || 0 })}
                  className="border-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Début de pause
                </label>
                <Input
                  type="time"
                  value={newSchedule.break_start_time || ""}
                  onChange={(e) => setNewSchedule({ ...newSchedule, break_start_time: e.target.value })}
                  className="border-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false)
                setSelectedDate(null)
                setSelectedEmployeeEmail("")
                setAttemptedSubmit(false)
              }}
              className="text-lg px-6 border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 flex items-center gap-2"
            >
              <XCircle className="h-5 w-5" /> Annuler
            </Button>
            <Button
              onClick={addSchedule}
              className="bg-red-600 hover:bg-red-700 text-lg px-6 flex items-center gap-2"
            >
              <CheckCircle className="h-5 w-5" /> Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de détails du jour */}
      <Dialog open={showDayDetailsDialog} onOpenChange={setShowDayDetailsDialog}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-gray-800 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center space-x-2 text-gray-900 dark:text-white">
              <CalendarDays className="h-7 w-7 text-red-600 dark:text-red-400" />
              <span>
                {selectedDate && selectedDate.toLocaleDateString("fr-FR", { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedDate && (() => {
            const daySchedules = getSchedulesForDate(selectedDate)
            const dateStr = selectedDate.toISOString().split('T')[0]
            const hasConflict = conflicts.includes(dateStr)
            
            return (
              <div className="space-y-4">
                {hasConflict && (
                  <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">Conflit d'horaires détecté ce jour</span>
                  </div>
                )}
                
                {daySchedules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun planning pour cette journée</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {daySchedules
                      .sort((a, b) => {
                        const timeA = (a as any).start_time || ''
                        const timeB = (b as any).start_time || ''
                        return timeA.localeCompare(timeB)
                      })
                      .map((schedule) => {
                        const scheduleData = schedule as any
                        const employeeName = scheduleData.employee_name || 'Employé'
                        const startTime = scheduleData.start_time || ''
                        const endTime = scheduleData.end_time || ''
                        const employeeEmail = scheduleData.employee_email || ''
                        const status = schedule.status
                        
                        return (
                          <div
                            key={schedule.id}
                            className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                            style={{ borderColor: getEmployeeColor(employeeEmail).replace('bg-', '#') }}
                            onClick={() => {
                              setSelectedSchedule(schedule)
                              setShowDayDetailsDialog(false)
                              setShowDetailsDialog(true)
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`w-3 h-3 rounded-full ${getEmployeeColor(employeeEmail)}`}></div>
                                  <span className="font-semibold text-lg text-gray-900 dark:text-white">
                                    {employeeName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-sm">{startTime} - {endTime}</span>
                                  </div>
                                  {scheduleData.break_duration && (
                                    <span className="text-sm">
                                      • Pause: {scheduleData.break_duration} min
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge
                                className={`${
                                  status === 'completed'
                                    ? 'bg-red-600 text-white'
                                    : status === 'confirmed'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-amber-500 text-white'
                                }`}
                              >
                                {status === 'completed'
                                  ? 'Terminé'
                                  : status === 'confirmed'
                                  ? 'Confirmé'
                                  : 'Programmé'}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900 dark:text-white">
              <Trash2 className="h-6 w-6 text-red-600" />
              <span>Confirmer la suppression</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Êtes-vous sûr de vouloir supprimer ce planning ?
              <br />
              <span className="text-red-600 font-medium">Cette action est irréversible.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirmDialog(false)
                setScheduleToDelete(null)
              }}
              className="border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Annuler
            </Button>
            <Button
              onClick={deleteSchedule}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
