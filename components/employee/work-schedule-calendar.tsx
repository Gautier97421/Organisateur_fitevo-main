"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
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

export function WorkScheduleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [newSchedule, setNewSchedule] = useState({
    start_time: "",
    end_time: "",
    break_duration: 15,
    break_start_time: "",
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

      const { data, error } = await supabase
        .from("work_schedules")
        .select("*")
        .gte("work_date", startOfMonth.toISOString().split("T")[0])
        .lte("work_date", endOfMonth.toISOString().split("T")[0])
        .order("work_date", { ascending: true })

      if (error) throw error
      setSchedules(data || [])
    } catch (error) {
      console.error("Erreur lors du chargement des plannings:", error)
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

  const addSchedule = async () => {
    if (!newSchedule.start_time || !newSchedule.end_time || !selectedDate) return

    try {
      const userEmail = localStorage.getItem("userEmail") || ""
      const userName = localStorage.getItem("userName") || ""

      const { data, error } = await supabase
        .from("work_schedules")
        .insert([
          {
            employee_email: userEmail,
            employee_name: userName,
            work_date: selectedDate.toISOString().split("T")[0],
            start_time: newSchedule.start_time,
            end_time: newSchedule.end_time,
            break_duration: newSchedule.break_duration,
            break_start_time: newSchedule.break_start_time || null,
            status: "scheduled",
          },
        ])

      if (error) throw error

      if (data) {
        setSchedules([...schedules, ...data])
      }

      setNewSchedule({
        start_time: "",
        end_time: "",
        break_duration: 15,
        break_start_time: "",
      })
      setShowScheduleDialog(false)
      setSelectedDate(null)

      alert("✅ Horaire de travail ajouté !")
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error)
      alert("Erreur lors de l'ajout de l'horaire")
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

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + (direction === "next" ? 1 : -1), 1))
  }

  const handleDateClick = (date: Date) => {
    if (date < new Date()) return // Empêcher la sélection de dates passées
    setSelectedDate(date)
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

  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

  return (
    <div className="space-y-6">
      {/* Navigation du calendrier */}
      <Card className="border border-gray-200 shadow-xl bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => navigateMonth("prev")}
              className="border-2 border-gray-300 rounded-xl bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-2xl font-bold text-gray-900">
              Planning - {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <Button
              variant="outline"
              onClick={() => navigateMonth("next")}
              className="border-2 border-gray-300 rounded-xl bg-white"
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
              const isPast = dayInfo.date < new Date() && dayInfo.isCurrentMonth

              return (
                <div
                  key={index}
                  onClick={() => dayInfo.isCurrentMonth && !isPast && handleDateClick(dayInfo.date)}
                  className={`
                    min-h-[100px] p-2 border rounded-xl cursor-pointer transition-all duration-200
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
                    ${isPast ? "cursor-not-allowed opacity-50" : "hover:shadow-md"}
                  `}
                >
                  <div className="font-semibold text-sm mb-1 text-gray-900">
                    {dayInfo.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {daySchedules.slice(0, 3).map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`text-xs p-1 rounded text-white truncate ${getEmployeeColor(schedule.employee_email)}`}
                        title={`${schedule.employee_name}: ${schedule.start_time} - ${schedule.end_time}${schedule.break_start_time ? ` (Pause: ${schedule.break_start_time})` : ""}`}
                      >
                        {schedule.employee_name.split(" ")[0]} {schedule.start_time}-{schedule.end_time}
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <div className="text-xs text-gray-500">
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
      <Card className="border border-gray-200 shadow-xl bg-white">
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

      {/* Dialog pour ajouter un horaire */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <Clock className="h-6 w-6 text-red-600" />
              <span>Nouvel Horaire de Travail</span>
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Heure de début
                </label>
                <Input
                  type="time"
                  value={newSchedule.start_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                  className="border-2 rounded-xl bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Heure de fin</label>
                <Input
                  type="time"
                  value={newSchedule.end_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                  className="border-2 rounded-xl bg-white text-gray-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Durée pause (min)
                </label>
                <Input
                  type="number"
                  value={newSchedule.break_duration}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, break_duration: Number.parseInt(e.target.value) || 15 })
                  }
                  min="0"
                  max="120"
                  className="border-2 rounded-xl bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Heure pause (optionnel)
                </label>
                <Input
                  type="time"
                  value={newSchedule.break_start_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, break_start_time: e.target.value })}
                  className="border-2 rounded-xl bg-white text-gray-900"
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
              }}
              className="text-lg px-6 border border-gray-300 hover:bg-gray-50 bg-white"
            >
              ❌ Annuler
            </Button>
            <Button onClick={addSchedule} className="bg-red-600 hover:bg-red-700 text-lg px-6">
              ✅ Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
