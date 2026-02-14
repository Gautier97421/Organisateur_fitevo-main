"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, Plus, CalendarDays, Edit2, Trash2 } from "lucide-react"
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
}

export function WorkScheduleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("") 
  const [selectedEmployee, setSelectedEmployee] = useState<{ email: string; name: string } | null>(null)
  const [showDayDetailsDialog, setShowDayDetailsDialog] = useState(false)
  const [selectedDayForDetails, setSelectedDayForDetails] = useState<Date | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [scheduleToEdit, setScheduleToEdit] = useState<WorkSchedule | null>(null)
  const [scheduleToDelete, setScheduleToDelete] = useState<WorkSchedule | null>(null)
  const [newSchedule, setNewSchedule] = useState({
    start_time: "",
    end_time: "",
  })

  const employeeColors = [
    "bg-red-600",
    "bg-gray-600",
    "bg-red-500",
    "bg-gray-500",
    "bg-red-700",
    "bg-gray-700",
    "bg-red-800",
    "bg-gray-800",
    "bg-red-400",
    "bg-gray-400",
  ]

  useEffect(() => {
    loadSchedules()
    loadEmployees()
  }, [currentDate])

  const loadSchedules = async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const response = await fetch(
        `/api/db/work_schedules?work_date_gte=${startOfMonth.toISOString().split("T")[0]}&work_date_lte=${endOfMonth.toISOString().split("T")[0]}&orderBy=work_date`
      )
      
      if (!response.ok) throw new Error('Erreur lors du chargement')
      
      const result = await response.json()
      const schedulesData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])
      
      setSchedules(schedulesData)
    } catch (error) {
      // Erreur silencieuse - l'interface affichera un état vide
    }
  }

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/db/employees?is_active=true')
      
      if (!response.ok) throw new Error('Erreur lors du chargement')
      
      const result = await response.json()
      const employeesData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])

      const employeesWithColors = employeesData.map((emp: any, index: number) => ({
        email: emp.email,
        name: emp.name,
        color: employeeColors[index % employeeColors.length],
      }))

      setEmployees(employeesWithColors)
    } catch (error) {
      // Erreur silencieuse
    }
  }

  const addSchedule = async () => {
    // Marquer qu'on a tenté de soumettre
    setAttemptedSubmit(true)
    setErrorMessage("")
    
    // Validation des champs obligatoires
    if (!newSchedule.start_time || !newSchedule.end_time || !selectedDate || !selectedEmployee) {
      setErrorMessage("⚠️ Saisie incomplète : veuillez remplir tous les champs obligatoires")
      return
    }

    // Recharger les schedules pour avoir les données à jour
    const selectedDateStr = selectedDate.toISOString().split("T")[0]
    
    try {
      // Récupérer les schedules du jour depuis l'API pour avoir les données fraîches
      // Utiliser une plage de dates pour éviter les problèmes de fuseaux horaires
      const checkResponse = await fetch(
        `/api/db/work_schedules?work_date_gte=${selectedDateStr}&work_date_lte=${selectedDateStr}&employee_email=${encodeURIComponent(selectedEmployee.email)}`
      )
      
      if (checkResponse.ok) {
        const checkResult = await checkResponse.json()
        const existingSchedules = Array.isArray(checkResult.data) ? checkResult.data : (checkResult.data ? [checkResult.data] : [])
        
        if (existingSchedules.length > 0) {
          // Vérifier les chevauchements d'horaires
          const newStart = newSchedule.start_time
          const newEnd = newSchedule.end_time

          const hasConflict = existingSchedules.some((existing: any) => {
            const existingStart = existing.start_time
            const existingEnd = existing.end_time

            // Vérifier si les horaires se chevauchent
            const conflict = (
              (newStart >= existingStart && newStart < existingEnd) || // Le début est dans un horaire existant
              (newEnd > existingStart && newEnd <= existingEnd) ||      // La fin est dans un horaire existant
              (newStart <= existingStart && newEnd >= existingEnd)      // L'horaire englobe un horaire existant
            )
            
            return conflict
          })

          if (hasConflict) {
            setErrorMessage(
              `⚠️ Conflit d'horaire : ${selectedEmployee.name} a déjà un planning sur cette plage horaire. Veuillez modifier ou supprimer l'horaire existant.`
            )
            return
          }
        }
      }

      // Pas de conflit, on peut ajouter
      const response = await fetch('/api/db/work_schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [{
            employee_email: selectedEmployee.email,
            employee_name: selectedEmployee.name,
            work_date: selectedDateStr,
            start_time: newSchedule.start_time,
            end_time: newSchedule.end_time,
            status: "scheduled",
          }]
        })
      })

      if (!response.ok) {
        setErrorMessage("❌ Erreur lors de l'enregistrement. Veuillez réessayer.")
        return
      }

      // Recharger les schedules depuis le serveur
      await loadSchedules()

      setNewSchedule({
        start_time: "",
        end_time: "",
      })
      setSelectedEmployee(null)
      setAttemptedSubmit(false)
      setErrorMessage("")
      setShowScheduleDialog(false)
      setSelectedDate(null)
    } catch (error) {
      setErrorMessage("❌ Erreur lors de l'enregistrement. Veuillez réessayer.")
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
    return schedules.filter((schedule) => {
      // Gérer différents formats de date
      const scheduleDate = schedule.work_date 
        ? (typeof schedule.work_date === 'string' 
            ? schedule.work_date.split("T")[0] 
            : new Date(schedule.work_date).toISOString().split("T")[0])
        : ''
      return scheduleDate === dateString
    })
  }

  const handleEditSchedule = async () => {
    if (!scheduleToEdit) return

    setAttemptedSubmit(true)
    setErrorMessage("")

    if (!newSchedule.start_time || !newSchedule.end_time) {
      setErrorMessage("⚠️ Veuillez remplir tous les champs obligatoires")
      return
    }

    if (newSchedule.start_time >= newSchedule.end_time) {
      setErrorMessage("⚠️ L'heure de début doit être avant l'heure de fin")
      return
    }

    try {
      const response = await fetch(`/api/db/work_schedules/${scheduleToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: newSchedule.start_time,
          end_time: newSchedule.end_time,
        })
      })

      if (!response.ok) {
        setErrorMessage("❌ Erreur lors de la modification. Veuillez réessayer.")
        return
      }

      await loadSchedules()
      setShowEditDialog(false)
      setScheduleToEdit(null)
      setNewSchedule({ start_time: "", end_time: "" })
      setAttemptedSubmit(false)
    } catch (error) {
      setErrorMessage("❌ Erreur lors de la modification. Veuillez réessayer.")
    }
  }

  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return

    try {
      const response = await fetch(`/api/db/work_schedules/${scheduleToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        setErrorMessage("❌ Erreur lors de la suppression. Veuillez réessayer.")
        return
      }

      await loadSchedules()
      setShowDeleteConfirmDialog(false)
      setScheduleToDelete(null)
    } catch (error) {
      setErrorMessage("❌ Erreur lors de la suppression. Veuillez réessayer.")
    }
  }

  const getEmployeeColor = (employeeEmail: string) => {
    const employee = employees.find((emp) => emp.email === employeeEmail)
    return employee?.color || "bg-gray-500"
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + (direction === "next" ? 1 : -1), 1))
  }

  const handleDateClick = (date: Date) => {
    if (date < new Date()) return // Empêcher la sélection de dates passées
    setSelectedDate(date)
    setAttemptedSubmit(false)
    setErrorMessage("")
    setShowScheduleDialog(true)
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

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Navigation du calendrier */}
      <Card className="border border-gray-200 shadow-xl bg-white">
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => navigateMonth("prev")}
              className="border-2 border-gray-300 rounded-xl bg-white px-2 md:px-4"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base md:text-xl lg:text-2xl font-bold text-gray-900 text-center">
              Planning - {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <Button
              variant="outline"
              onClick={() => navigateMonth("next")}
              className="border-2 border-gray-300 rounded-xl bg-white px-2 md:px-4"
              size="sm"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {/* En-têtes des jours */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 md:mb-4">
            {dayNames.map((day) => (
              <div key={day} className="text-center font-semibold text-gray-600 py-1 md:py-2 text-xs md:text-sm">
                {day}
              </div>
            ))}
          </div>

          {/* Grille du calendrier */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {getDaysInMonth().map((dayInfo, index) => {
              const daySchedules = getSchedulesForDate(dayInfo.date)
              const isToday = dayInfo.date.toDateString() === new Date().toDateString() && dayInfo.isCurrentMonth
              const isPast = dayInfo.date < new Date() && dayInfo.isCurrentMonth

              return (
                <div
                  key={index}
                  onClick={() => {
                    if (dayInfo.isCurrentMonth) {
                      setSelectedDayForDetails(dayInfo.date)
                      setShowDayDetailsDialog(true)
                    }
                  }}
                  className={`
                    relative min-h-[60px] md:min-h-[100px] p-1 md:p-2 border rounded-lg md:rounded-xl cursor-pointer transition-all duration-200
                    ${
                      dayInfo.isCurrentMonth
                        ? "bg-white hover:bg-red-50"
                        : "bg-gray-50 text-gray-400"
                    }
                    ${
                      isToday
                        ? "border-red-500 bg-red-100"
                        : "border-gray-200"
                    }
                    ${dayInfo.isCurrentMonth ? "hover:shadow-md" : ""}
                  `}
                >
                  <div className="font-semibold text-[10px] md:text-sm mb-0.5 md:mb-1 text-gray-900">
                    {dayInfo.date.getDate()}
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    {daySchedules.slice(0, 2).map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`text-[8px] md:text-xs p-0.5 md:p-1 rounded text-white truncate ${getEmployeeColor(schedule.employee_email)}`}
                        title={`${schedule.employee_name || 'Sans nom'}: ${schedule.start_time || ''} - ${schedule.end_time || ''}${schedule.break_start_time ? ` (Pause: ${schedule.break_start_time})` : ""}`}
                      >
                        <span className="hidden md:inline">{schedule.employee_name ? schedule.employee_name.split(" ")[0] : 'Employé'} </span>
                        {schedule.start_time || ''}-{schedule.end_time || ''}
                      </div>
                    ))}
                    {daySchedules.length > 2 && (
                      <div className="text-[8px] md:text-xs text-gray-500">
                        +{daySchedules.length - 2}
                      </div>
                    )}
                  </div>
                  {dayInfo.isCurrentMonth && !isPast && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDateClick(dayInfo.date)
                      }}
                        className="absolute bottom-1 right-1 p-0.5 bg-gray-600 hover:bg-gray-500 text-white rounded-full shadow-lg transition-all hover:scale-110"
                      title="Ajouter un horaire"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Légende des employés */}
      <Card className="border border-gray-200 shadow-xl bg-white">
        <CardContent className="p-3 md:p-4">
          <h4 className="font-semibold mb-2 md:mb-3 text-sm md:text-base text-gray-900">Légende des employés :</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
            {employees.map((employee) => (
              <div key={employee.email} className="flex items-center space-x-2">
                <div className={`w-4 h-4 ${employee.color} rounded`}></div>
                <span className="text-sm text-gray-700">{employee.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog pour ajouter un horaire */}
      <Dialog open={showScheduleDialog} onOpenChange={(open) => {
        setShowScheduleDialog(open)
        if (!open) {
          setAttemptedSubmit(false)
          setErrorMessage("")
          setSelectedDate(null)
          setSelectedEmployee(null)
        }
      }}>
        <DialogContent className="sm:max-w-md bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
              <Clock className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
              <span>Nouvel Horaire de Travail</span>
            </DialogTitle>
            <DialogDescription className="text-sm md:text-base text-gray-600">
              {selectedDate && (
                <>
                  Date sélectionnée :{" "}
                  <strong>
                    {selectedDate.toLocaleDateString("fr-FR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {errorMessage && (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 mb-4">
              <p className="text-red-700 text-sm font-medium text-center">{errorMessage}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Employé <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedEmployee?.email || ""}
                onValueChange={(email) => {
                  const emp = employees.find(e => e.email === email)
                  if (emp) setSelectedEmployee({ email: emp.email, name: emp.name })
                }}
              >
                <SelectTrigger className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !selectedEmployee ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.email} value={employee.email}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Heure de début <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={newSchedule.start_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                  className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.start_time ? 'border-red-500 focus:border-red-600' : ''}`}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Heure de fin <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={newSchedule.end_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                  className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.end_time ? 'border-red-500 focus:border-red-600' : ''}`}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowScheduleDialog(false)
                setSelectedDate(null)
                setSelectedEmployee(null)
                setAttemptedSubmit(false)
                setErrorMessage("")
              }}
              className="text-lg px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-2"
            >
              <XCircle className="h-5 w-5" /> Annuler
            </Button>
            <Button onClick={addSchedule} className="bg-red-600 hover:bg-red-700 text-lg px-6 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" /> Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de détails du jour */}
      <Dialog open={showDayDetailsDialog} onOpenChange={setShowDayDetailsDialog}>
        <DialogContent className="sm:max-w-2xl bg-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center space-x-2 text-gray-900">
              <CalendarDays className="h-6 w-6 text-red-600" />
              <span>
                Horaires du {selectedDayForDetails && new Date(selectedDayForDetails).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedDayForDetails && (() => {
              const daySchedules = getSchedulesForDate(selectedDayForDetails).sort((a, b) => {
                return a.start_time.localeCompare(b.start_time)
              })

              if (daySchedules.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDays className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg">Aucun horaire pour ce jour</p>
                  </div>
                )
              }

              // Détection des conflits d'horaires
              const hasConflicts = daySchedules.some((schedule, index) => {
                if (index === 0) return false
                const prevEnd = daySchedules[index - 1].end_time
                const currentStart = schedule.start_time
                return currentStart < prevEnd
              })

              return (
                <>
                  {hasConflicts && (
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-3 mb-4">
                      <p className="text-yellow-800 font-medium flex items-center gap-2">
                        <span className="text-yellow-600 text-xl">⚠️</span>
                        Attention : Certains horaires se chevauchent
                      </p>
                    </div>
                  )}
                  {daySchedules.map((schedule) => {
                    const userEmail = localStorage.getItem("userEmail")
                    const isOwnSchedule = schedule.employee_email === userEmail
                    const today = new Date().toISOString().split('T')[0]
                    const isPast = schedule.work_date < today
                    const canModify = isOwnSchedule && !isPast

                    return (
                      <Card
                        key={schedule.id}
                        className={`border-2 bg-white ${isOwnSchedule ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className={`w-4 h-4 ${getEmployeeColor(schedule.employee_email)} rounded`}></div>
                              <h4 className="font-bold text-lg text-gray-900">{schedule.employee_name}</h4>
                              {isOwnSchedule && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-white">
                                  Vous
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
                              schedule.status === "completed" ? "bg-green-600" :
                              schedule.status === "confirmed" ? "bg-blue-600" : "bg-gray-600"
                            }`}>
                              {schedule.status === "completed" ? "Terminé" : 
                               schedule.status === "confirmed" ? "Confirmé" : "Programmé"}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span className="font-medium">
                                {schedule.start_time} - {schedule.end_time}
                              </span>
                            </div>
                            {schedule.break_start_time && schedule.break_duration && (
                              <p className="text-gray-600 text-xs mt-1">
                                🕐 Pause : {schedule.break_start_time} ({schedule.break_duration} min)
                              </p>
                            )}
                          </div>
                          {canModify && (
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setScheduleToEdit(schedule)
                                  setNewSchedule({
                                    start_time: schedule.start_time,
                                    end_time: schedule.end_time,
                                  })
                                  setShowDayDetailsDialog(false)
                                  setShowEditDialog(true)
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                              >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Modifier
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setScheduleToDelete(schedule)
                                  setShowDayDetailsDialog(false)
                                  setShowDeleteConfirmDialog(true)
                                }}
                                className="border-red-600 text-red-600 hover:bg-red-50 flex-1"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Supprimer
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </>
              )
            })()}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowDayDetailsDialog(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition de planning */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open)
        if (!open) {
          setScheduleToEdit(null)
          setNewSchedule({ start_time: "", end_time: "" })
          setAttemptedSubmit(false)
          setErrorMessage("")
        }
      }}>
        <DialogContent className="sm:max-w-md bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
              <Edit2 className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              <span>Modifier l'Horaire de Travail</span>
            </DialogTitle>
            <DialogDescription className="text-sm md:text-base text-gray-600">
              {scheduleToEdit && (
                <>
                  {scheduleToEdit.employee_name} - {new Date(scheduleToEdit.work_date + 'T00:00:00').toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {errorMessage && (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 mb-4">
              <p className="text-red-700 text-sm font-medium text-center">{errorMessage}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Heure de début <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={newSchedule.start_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                  className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.start_time ? 'border-red-500 focus:border-red-600' : ''}`}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Heure de fin <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={newSchedule.end_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                  className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.end_time ? 'border-red-500 focus:border-red-600' : ''}`}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="flex-1 border-2 rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleEditSchedule}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
              <Trash2 className="h-5 w-5 text-red-600" />
              <span>Confirmer la suppression</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Êtes-vous sûr de vouloir supprimer ce planning ?
              {scheduleToDelete && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">{scheduleToDelete.employee_name}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(scheduleToDelete.work_date + 'T00:00:00').toLocaleDateString("fr-FR")} - {scheduleToDelete.start_time} à {scheduleToDelete.end_time}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirmDialog(false)}
              className="flex-1 border-2 rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleDeleteSchedule}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
