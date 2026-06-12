"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, Plus, CalendarDays, Edit2, Trash2, AlertTriangle } from "lucide-react"
import { getUserId, getUserEmail } from "@/lib/current-user"
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
  end_date?: string
  label?: string   // "travail" | "conges"
  gym_id?: string
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

interface Gym {
  id: string
  name: string
}

interface WorkScheduleCalendarProps {
  hasWorkScheduleAccess?: boolean
}

export function WorkScheduleCalendar({ hasWorkScheduleAccess = true }: WorkScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [userGyms, setUserGyms] = useState<Gym[]>([])
  const [selectedGymId, setSelectedGymId] = useState<string>("all")
  const [conflicts, setConflicts] = useState<string[]>([])
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
    label: "travail" as "travail" | "conges",
    start_time: "",
    end_time: "",
    end_date: "",
  })
  const [isManager, setIsManager] = useState(false)
  const [currentUserInfo, setCurrentUserInfo] = useState<{ email: string; name: string } | null>(null)

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
    const loadCurrentUser = async () => {
      try {
        const userId = getUserId()
        if (!userId) return
        const res = await fetch(`/api/db/users/${userId}`)
        if (!res.ok) return
        const result = await res.json()
        const user = result.data
        if (!user) return
        const info = { email: user.email, name: user.name }
        setCurrentUserInfo(info)
        const manager = user.has_manager_access === true
        setIsManager(manager)
        if (!manager) setSelectedEmployee(info)
      } catch {
        // silencieux
      }
    }
    loadCurrentUser()
  }, [])

  useEffect(() => {
    const loadData = async () => {
      const gyms = await loadUserGyms()
      if (gyms) {
        loadSchedules(gyms)
        loadEmployees(gyms)
      }
    }
    loadData()
  }, [currentDate, selectedGymId])

  const loadUserGyms = async () => {
    try {
      const userId = getUserId()
      if (!userId) return null

      // Charger les salles accessibles par l'utilisateur
      const response = await fetch(`/api/db/user_gyms?user_id=${userId}`)
      if (!response.ok) return null

      const result = await response.json()
      const userGymData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])

      // Charger uniquement les informations des salles spécifiques auxquelles l'utilisateur a accès
      const gymIds = userGymData.map((ug: any) => ug.gym_id)
      if (gymIds.length === 0) {
        setUserGyms([])
        return []
      }

      // Charger chaque salle individuellement pour éviter d'exposer les autres salles
      const gymsPromises = gymIds.map(async (gymId: string) => {
        try {
          const gymResponse = await fetch(`/api/db/gyms/${gymId}`)
          if (!gymResponse.ok) return null
          const gymResult = await gymResponse.json()
          return gymResult.data
        } catch {
          return null
        }
      })

      const gyms = await Promise.all(gymsPromises)
      const accessibleGyms = gyms.filter((gym: any) => gym !== null && gym.is_active !== false)
      setUserGyms(accessibleGyms)
      return accessibleGyms
    } catch (error) {
      setUserGyms([])
      return []
    }
  }

  const loadSchedules = async (gyms?: any[]) => {
    try {
      // Utiliser les gyms passés en paramètre ou ceux du state
      const gymsToUse = gyms || userGyms
      
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      let url = `/api/db/work_schedules?work_date_gte=${startOfMonth.toISOString().split("T")[0]}&work_date_lte=${endOfMonth.toISOString().split("T")[0]}&orderBy=work_date`

      // Si l'utilisateur n'a aucune salle assignée, ne rien charger
      if (gymsToUse.length === 0) {
        setSchedules([])
        setConflicts([])
        return
      }

      // Si l'utilisateur a des salles spécifiques, filtrer par ces salles
      if (selectedGymId === "all") {
        // Charger les plannings de toutes les salles accessibles
        // Note: L'API ne supporte pas les filtres multiples, donc on filtre côté client
      } else {
        // Filtrer par salle spécifique
        url += `&gym_id=${selectedGymId}`
      }

      const response = await fetch(url)
      
      if (!response.ok) throw new Error('Erreur lors du chargement')
      
      const result = await response.json()
      let schedulesData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])
      
      // Toujours filtrer côté client pour ne garder que les salles accessibles
      const gymIds = gymsToUse.map(g => g.id)
      schedulesData = schedulesData.filter((s: WorkSchedule) => 
        s.gym_id && gymIds.includes(s.gym_id)
      )
      
      // Exclure les périodes de travail temporaires (celles créées par les employés)
      // On ne garde que les plannings prévus (is_temporary = false ou undefined)
      schedulesData = schedulesData.filter((s: any) => 
        !s.is_temporary
      )
      
      // Récupérer les infos utilisateurs pour filtrer les admins
      const usersResponse = await fetch('/api/db/users')
      if (usersResponse.ok) {
        const usersResult = await usersResponse.json()
        const users = usersResult.data || []
        
        // Créer un map email -> rôle
        const userRoles = new Map<string, string>()
        users.forEach((user: any) => {
          userRoles.set(user.email, user.role)
        })
        
        // Filtrer pour ne garder que les plannings des employés (exclure admins et superadmins)
        schedulesData = schedulesData.filter((schedule: WorkSchedule) => {
          const role = userRoles.get(schedule.employee_email)
          return role === 'employee'
        })
      }
      
      setSchedules(schedulesData)
      detectConflicts(schedulesData)
    } catch (error) {
      // Erreur silencieuse - l'interface affichera un état vide
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

          // Vérifier uniquement si c'est la MÊME personne
          if (schedule1.employee_email !== schedule2.employee_email) {
            continue
          }

          // Vérifier si les horaires se chevauchent pour la même personne
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

  const loadEmployees = async (gyms?: any[]) => {
    try {
      // Utiliser les gyms passés en paramètre ou ceux du state
      const gymsToUse = gyms || userGyms
      
      const response = await fetch('/api/db/employees?is_active=true')
      
      if (!response.ok) throw new Error('Erreur lors du chargement')
      
      const result = await response.json()
      const employeesData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])

      // Si l'utilisateur n'a pas de salles assignées, ne montrer aucun employé
      if (gymsToUse.length === 0) {
        setEmployees([])
        return
      }

      // Filtrer les employés pour ne garder que ceux des salles accessibles
      const gymIds = gymsToUse.map(g => g.id)
      
      // Charger les associations user_gyms pour filtrer les employés
      const userGymsResponse = await fetch('/api/db/user_gyms')
      if (userGymsResponse.ok) {
        const userGymsResult = await userGymsResponse.json()
        const allUserGyms = userGymsResult.data || []
        
        // Créer un Set des IDs utilisateurs qui ont accès aux mêmes salles
        const employeeIdsWithAccess = new Set<string>()
        allUserGyms.forEach((ug: any) => {
          if (gymIds.includes(ug.gym_id)) {
            employeeIdsWithAccess.add(ug.user_id)
          }
        })
        
        // Charger tous les utilisateurs pour mapper user_id -> email
        const usersResponse = await fetch('/api/db/users')
        if (usersResponse.ok) {
          const usersResult = await usersResponse.json()
          const allUsers = usersResult.data || []
          const userIdToEmail = new Map<string, string>()
          allUsers.forEach((u: any) => {
            userIdToEmail.set(u.id, u.email)
          })
          
          // Filtrer les employés pour ne garder que ceux qui ont accès aux mêmes salles
          const filteredEmployees = employeesData.filter((emp: any) => {
            // Trouver le user_id correspondant à l'email
            const userId = [...userIdToEmail.entries()].find(([id, email]) => email === emp.email)?.[0]
            return userId && employeeIdsWithAccess.has(userId)
          })
          
          const employeesWithColors = filteredEmployees.map((emp: any, index: number) => ({
            email: emp.email,
            name: emp.name,
            color: employeeColors[index % employeeColors.length],
          }))

          setEmployees(employeesWithColors)
          return
        }
      }

      // En cas d'erreur, ne montrer aucun employé par sécurité
      setEmployees([])
    } catch (error) {
      // Erreur silencieuse - ne montrer aucun employé par sécurité
      setEmployees([])
    }
  }

  const addSchedule = async () => {
    // Marquer qu'on a tenté de soumettre
    setAttemptedSubmit(true)
    setErrorMessage("")
    
    // Validation des champs obligatoires selon le label
    if (!selectedDate || !selectedEmployee) {
      setErrorMessage("⚠️ Saisie incomplète : veuillez remplir tous les champs obligatoires")
      return
    }
    if (newSchedule.label === "travail" && (!newSchedule.start_time || !newSchedule.end_time)) {
      setErrorMessage("⚠️ Pour un jour de travail, les heures de début et de fin sont obligatoires")
      return
    }
    if (newSchedule.label === "conges" && !newSchedule.end_date) {
      setErrorMessage("⚠️ Pour des congés, la date de fin est obligatoire")
      return
    }
    if (newSchedule.label === "conges" && newSchedule.end_date < selectedDate.toISOString().split("T")[0]) {
      setErrorMessage("⚠️ La date de fin des congés doit être égale ou postérieure à la date de début")
      return
    }

    // Validation de la salle si l'utilisateur a accès à plusieurs salles
    if (userGyms.length > 1 && selectedGymId === "all") {
      setErrorMessage("⚠️ Veuillez sélectionner une salle spécifique pour ce planning")
      return
    }

    // Recharger les schedules pour avoir les données à jour
    const selectedDateStr = selectedDate.toISOString().split("T")[0]
    
    try {
      // Récupérer les schedules du jour depuis l'API pour avoir les données fraîches
      // Note: On charge TOUS les horaires du jour pour vérifier uniquement les conflits avec le même employé
      const checkResponse = await fetch(
        `/api/db/work_schedules?work_date_gte=${selectedDateStr}&work_date_lte=${selectedDateStr}`
      )
      
      if (checkResponse.ok) {
        const checkResult = await checkResponse.json()
        let existingSchedules = Array.isArray(checkResult.data) ? checkResult.data : (checkResult.data ? [checkResult.data] : [])
        
        
        // Filtrer côté client pour garantir qu'on vérifie uniquement les horaires du même employé ET du même jour (exclure les périodes temporaires et les congés)
        existingSchedules = existingSchedules.filter((s: any) => {
          const isSameEmployee = s.employee_email === selectedEmployee.email
          const scheduleDate = s.work_date?.split('T')[0] || s.work_date
          const isSameDate = scheduleDate === selectedDateStr
          const isNotTemporary = !s.is_temporary
          const isWork = (s.label || "travail") === "travail"
          return isSameEmployee && isSameDate && isNotTemporary && isWork
        })
        
        
        if (existingSchedules.length > 0) {
          // Vérifier les chevauchements d'horaires pour le même employé uniquement
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
      const scheduleData: any = {
        employee_email: selectedEmployee.email,
        employee_name: selectedEmployee.name,
        work_date: selectedDateStr,
        label: newSchedule.label,
        start_time: newSchedule.label === "travail" ? newSchedule.start_time : "",
        end_time: newSchedule.label === "travail" ? newSchedule.end_time : "",
        end_date: newSchedule.label === "conges" ? newSchedule.end_date : null,
        status: "scheduled",
      }

      // Ajouter gym_id si une salle spécifique est sélectionnée
      if (selectedGymId !== "all") {
        scheduleData.gym_id = selectedGymId
      } else if (userGyms.length === 1) {
        // Si l'utilisateur n'a accès qu'à une seule salle, l'utiliser automatiquement
        scheduleData.gym_id = userGyms[0].id
      }

      const response = await fetch('/api/db/work_schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [scheduleData]
        })
      })

      if (!response.ok) {
        setErrorMessage("❌ Erreur lors de l'enregistrement. Veuillez réessayer.")
        return
      }

      // Recharger les schedules depuis le serveur
      await loadSchedules()

      setNewSchedule({ label: "travail", start_time: "", end_time: "", end_date: "" })
      if (isManager) setSelectedEmployee(null)
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
      const scheduleDate = schedule.work_date
        ? (typeof schedule.work_date === 'string'
            ? schedule.work_date.split("T")[0]
            : new Date(schedule.work_date).toISOString().split("T")[0])
        : ''
      if ((schedule.label || "travail") === "conges" && schedule.end_date) {
        const endDate = typeof schedule.end_date === 'string'
          ? schedule.end_date.split("T")[0]
          : new Date(schedule.end_date).toISOString().split("T")[0]
        return scheduleDate <= dateString && endDate >= dateString
      }
      return scheduleDate === dateString
    })
  }

  const handleEditSchedule = async () => {
    if (!scheduleToEdit) return

    setAttemptedSubmit(true)
    setErrorMessage("")

    if (newSchedule.label === "travail") {
      if (!newSchedule.start_time || !newSchedule.end_time) {
        setErrorMessage("⚠️ Veuillez remplir les heures de début et de fin")
        return
      }
      if (newSchedule.start_time >= newSchedule.end_time) {
        setErrorMessage("⚠️ L'heure de début doit être avant l'heure de fin")
        return
      }
    } else {
      if (!newSchedule.end_date) {
        setErrorMessage("⚠️ Veuillez renseigner la date de fin des congés")
        return
      }
    }

    try {
      const patchData: any = {
        label: newSchedule.label,
        start_time: newSchedule.label === "travail" ? newSchedule.start_time : "",
        end_time: newSchedule.label === "travail" ? newSchedule.end_time : "",
        end_date: newSchedule.label === "conges" ? newSchedule.end_date : null,
      }
      const response = await fetch(`/api/db/work_schedules/${scheduleToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData)
      })

      if (!response.ok) {
        setErrorMessage("❌ Erreur lors de la modification. Veuillez réessayer.")
        return
      }

      await loadSchedules()
      setShowEditDialog(false)
      setScheduleToEdit(null)
      setNewSchedule({ label: "travail", start_time: "", end_time: "", end_date: "" })
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
    // Empêcher la sélection de dates passées (mais autoriser le jour actuel)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selectedDay = new Date(date)
    selectedDay.setHours(0, 0, 0, 0)
    if (selectedDay < today) return
    
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
      {/* Titre */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Planning de travail</h2>
        <p className="text-sm text-gray-500 mt-0.5">Consultez et gérez les horaires et congés de l'équipe</p>
      </div>

      {/* Sélecteur de salle (si plusieurs salles accessibles) */}
      {userGyms.length > 1 && (
        <Card className="border border-gray-200 shadow-lg bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Filtrer par salle :
              </label>
              <Select value={selectedGymId} onValueChange={setSelectedGymId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Toutes les salles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les salles</SelectItem>
                  {userGyms.map((gym) => (
                    <SelectItem key={gym.id} value={gym.id}>
                      {gym.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

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
              const hasConflict = conflicts.includes(dayInfo.date.toISOString().split("T")[0])

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
                        : hasConflict
                        ? "border-yellow-500 bg-yellow-50"
                        : "border-gray-200"
                    }
                    ${dayInfo.isCurrentMonth ? "hover:shadow-md" : ""}
                  `}
                >
                  <div className="flex items-center justify-between mb-0.5 md:mb-1">
                    <div className="font-semibold text-[10px] md:text-sm text-gray-900">
                      {dayInfo.date.getDate()}
                    </div>
                    {hasConflict && (
                      <span className="text-yellow-600" title="Conflit d'horaires">
                        ⚠️
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    {daySchedules.slice(0, 2).map((schedule) => {
                      const isConges = (schedule.label || "travail") === "conges"
                      return (
                        <div
                          key={schedule.id}
                          className={`text-[8px] md:text-xs p-0.5 md:p-1 rounded text-white truncate ${isConges ? "bg-green-600" : getEmployeeColor(schedule.employee_email)}`}
                          title={`${schedule.employee_name || 'Sans nom'}: ${isConges ? "Congés" : `${schedule.start_time || ''} - ${schedule.end_time || ''}`}`}
                        >
                          <span className="hidden md:inline">{schedule.employee_name ? schedule.employee_name.split(" ")[0] : 'Employé'} </span>
                          {isConges ? "🏖️" : `${schedule.start_time || ''}-${schedule.end_time || ''}`}
                        </div>
                      )
                    })}
                    {daySchedules.length > 2 && (
                      <div className="text-[8px] md:text-xs text-gray-500">
                        +{daySchedules.length - 2}
                      </div>
                    )}
                  </div>
                  {dayInfo.isCurrentMonth && !isPast && hasWorkScheduleAccess && (
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
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-600 text-lg">⚠️</span>
              <span className="text-sm text-gray-700">Conflit d'horaires</span>
            </div>
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
          if (isManager) setSelectedEmployee(null)
          // Non-manager : on garde selectedEmployee pointé sur soi-même
        }
      }}>
        <DialogContent className="max-w-[90vw] sm:max-w-md bg-white max-h-[90vh] overflow-y-auto rounded-2xl">
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
            {/* Label Travail / Congés */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Type <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewSchedule({ ...newSchedule, label: "travail" })}
                  className={`flex-1 py-2 px-4 rounded-xl border-2 text-sm font-medium transition-all ${newSchedule.label === "travail" ? "bg-red-600 border-red-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-red-400"}`}
                >
                  Travail
                </button>
                <button
                  type="button"
                  onClick={() => setNewSchedule({ ...newSchedule, label: "conges" })}
                  className={`flex-1 py-2 px-4 rounded-xl border-2 text-sm font-medium transition-all ${newSchedule.label === "conges" ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-green-400"}`}
                >
                  Congés
                </button>
              </div>
            </div>

            {isManager ? (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Employé <span className="text-red-500">*</span></label>
                <Select
                  value={selectedEmployee?.email || ""}
                  onValueChange={(email) => {
                    const emp = employees.find(e => e.email === email)
                    if (emp) setSelectedEmployee({ email: emp.email, name: emp.name })
                    else if (currentUserInfo && email === currentUserInfo.email) setSelectedEmployee(currentUserInfo)
                  }}
                >
                  <SelectTrigger className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !selectedEmployee ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Sélectionner un employé" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUserInfo && (
                      <SelectItem value={currentUserInfo.email}>{currentUserInfo.name} (moi)</SelectItem>
                    )}
                    {employees.filter(e => e.email !== currentUserInfo?.email).map((employee) => (
                      <SelectItem key={employee.email} value={employee.email}>{employee.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Employé</label>
                <p className="text-sm text-gray-800 font-medium px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                  {currentUserInfo?.name || "—"}
                </p>
              </div>
            )}

            {userGyms.length > 1 && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Salle <span className="text-red-500">*</span></label>
                <Select value={selectedGymId} onValueChange={setSelectedGymId}>
                  <SelectTrigger className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && selectedGymId === 'all' ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Sélectionner une salle" />
                  </SelectTrigger>
                  <SelectContent>
                    {userGyms.map((gym) => (
                      <SelectItem key={gym.id} value={gym.id}>{gym.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {userGyms.length === 1 && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Salle</label>
                <Input type="text" value={userGyms[0].name} disabled className="border-2 rounded-xl bg-gray-100 text-gray-700 cursor-not-allowed" />
              </div>
            )}

            {/* Champs selon le type */}
            {newSchedule.label === "travail" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Heure de début <span className="text-red-500">*</span></label>
                  <Input
                    type="time"
                    value={newSchedule.start_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                    className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.start_time ? 'border-red-500' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Heure de fin <span className="text-red-500">*</span></label>
                  <Input
                    type="time"
                    value={newSchedule.end_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                    className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.end_time ? 'border-red-500' : ''}`}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Date de fin des congés <span className="text-red-500">*</span></label>
                <p className="text-xs text-gray-500 mb-1">La date de début est la date sélectionnée sur le calendrier.</p>
                <Input
                  type="date"
                  value={newSchedule.end_date}
                  min={selectedDate ? selectedDate.toISOString().split("T")[0] : ""}
                  onChange={(e) => setNewSchedule({ ...newSchedule, end_date: e.target.value })}
                  className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.end_date ? 'border-red-500' : ''}`}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowScheduleDialog(false)
                setSelectedDate(null)
                setSelectedEmployee(null)
                setAttemptedSubmit(false)
                setErrorMessage("")
              }}
              className="border-gray-300 flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" /> Annuler
            </Button>
            <Button onClick={addSchedule} className="bg-red-600 hover:bg-red-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de détails du jour */}
      <Dialog open={showDayDetailsDialog} onOpenChange={setShowDayDetailsDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-2xl bg-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-2xl flex items-center gap-2 text-gray-900">
              <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 flex-shrink-0" />
              <span className="break-words">
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

              // Détection des conflits d'horaires (uniquement pour le même employé)
              const hasConflicts = daySchedules.some((schedule, index) => {
                // Vérifier si cet horaire chevauche un autre horaire du même employé
                return daySchedules.some((otherSchedule, otherIndex) => {
                  if (index === otherIndex) return false // Ne pas se comparer à soi-même
                  if (schedule.employee_email !== otherSchedule.employee_email) return false // Ignorer les autres employés
                  
                  // Vérifier le chevauchement d'horaires
                  const start = schedule.start_time
                  const end = schedule.end_time
                  const otherStart = otherSchedule.start_time
                  const otherEnd = otherSchedule.end_time
                  
                  return (
                    (start >= otherStart && start < otherEnd) ||
                    (end > otherStart && end <= otherEnd) ||
                    (start <= otherStart && end >= otherEnd)
                  )
                })
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
                    const userEmail = getUserEmail()
                    const isOwnSchedule = schedule.employee_email === userEmail
                    const today = new Date().toISOString().split('T')[0]
                    const isPast = schedule.work_date < today
                    const canModify = isOwnSchedule && !isPast && hasWorkScheduleAccess

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
                            {(schedule.label || "travail") === "conges" ? (
                              <div className="flex items-center gap-2">
                                <span className="text-base">🏖️</span>
                                <span className="font-medium text-green-700">
                                  Congés{schedule.end_date ? ` jusqu'au ${new Date(schedule.end_date + (schedule.end_date.includes("T") ? "" : "T00:00:00")).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-medium">{schedule.start_time} - {schedule.end_time}</span>
                                </div>
                                {schedule.break_start_time && schedule.break_duration && (
                                  <p className="text-gray-600 text-xs mt-1">
                                    🕐 Pause : {schedule.break_start_time} ({schedule.break_duration} min)
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          {canModify && (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setScheduleToEdit(schedule)
                                  setNewSchedule({
                                    label: (schedule.label || "travail") as "travail" | "conges",
                                    start_time: schedule.start_time || "",
                                    end_time: schedule.end_time || "",
                                    end_date: schedule.end_date ? schedule.end_date.split("T")[0] : "",
                                  })
                                  setShowDayDetailsDialog(false)
                                  setShowEditDialog(true)
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
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
                                className="border-red-600 text-red-600 hover:bg-red-50"
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
          setNewSchedule({ label: "travail", start_time: "", end_time: "", end_date: "" })
          setAttemptedSubmit(false)
          setErrorMessage("")
        }
      }}>
        <DialogContent className="max-w-[90vw] sm:max-w-md bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
              <Edit2 className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              <span>Modifier le planning</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              {scheduleToEdit && `${scheduleToEdit.employee_name} — ${new Date(scheduleToEdit.work_date + 'T00:00:00').toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 mb-4">
              <p className="text-red-700 text-sm font-medium text-center">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Label */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewSchedule({ ...newSchedule, label: "travail" })}
                  className={`flex-1 py-2 px-4 rounded-xl border-2 text-sm font-medium transition-all ${newSchedule.label === "travail" ? "bg-red-600 border-red-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-red-400"}`}
                >
                  Travail
                </button>
                <button
                  type="button"
                  onClick={() => setNewSchedule({ ...newSchedule, label: "conges" })}
                  className={`flex-1 py-2 px-4 rounded-xl border-2 text-sm font-medium transition-all ${newSchedule.label === "conges" ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-green-400"}`}
                >
                  Congés
                </button>
              </div>
            </div>

            {newSchedule.label === "travail" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Heure de début <span className="text-red-500">*</span></label>
                  <Input
                    type="time"
                    value={newSchedule.start_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                    className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.start_time ? 'border-red-500' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Heure de fin <span className="text-red-500">*</span></label>
                  <Input
                    type="time"
                    value={newSchedule.end_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                    className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.end_time ? 'border-red-500' : ''}`}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Date de fin des congés <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={newSchedule.end_date}
                  min={scheduleToEdit ? scheduleToEdit.work_date.split("T")[0] : ""}
                  onChange={(e) => setNewSchedule({ ...newSchedule, end_date: e.target.value })}
                  className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newSchedule.end_date ? 'border-red-500' : ''}`}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="flex-1 border-gray-300">
              Annuler
            </Button>
            <Button onClick={handleEditSchedule} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
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
