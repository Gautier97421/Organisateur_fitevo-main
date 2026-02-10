"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TodoList } from "@/components/employee/todo-list"
import { BreakManager } from "@/components/employee/break-manager"
import { EmergencyButton } from "@/components/employee/emergency-button"
import { CalendarView } from "@/components/employee/calendar-view"
import { SimpleTimeTracker } from "@/components/employee/simple-time-tracker"
import { WorkScheduleCalendar } from "@/components/employee/work-schedule-calendar"
import { NewMemberInstructionsDialog } from "@/components/employee/new-member-instructions-dialog"
import { useRouter } from "next/navigation"
import { MessageCircle, UserPlus, CheckCircle, XCircle, Building, MapPin, HardHat, AlertTriangle, Home, Lock, Sunrise, Sunset, Sun, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function EmployeePage() {
  const [userEmail, setUserEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [userRoleId, setUserRoleId] = useState<string | null>(null)
  const [hasWorkScheduleAccess, setHasWorkScheduleAccess] = useState(false)
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false)
  const [hasWorkPeriodAccess, setHasWorkPeriodAccess] = useState(false)
  const [currentView, setCurrentView] = useState<"menu" | "tasks" | "calendar" | "schedule">("menu")
  const [selectedPeriod, setSelectedPeriod] = useState<"matin" | "aprem" | "journee" | null>(null)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null)
  const [accumulatedBreakTime, setAccumulatedBreakTime] = useState(0) // en minutes
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingPeriod, setPendingPeriod] = useState<"matin" | "aprem" | "journee" | null>(null)
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false)
  const [instructions, setInstructions] = useState<any[]>([])
  const [whatsappLink, setWhatsappLink] = useState("")
  const [assignedGyms, setAssignedGyms] = useState<any[]>([])
  const [selectedGym, setSelectedGym] = useState<any | null>(null)
  const [showGymSelectionDialog, setShowGymSelectionDialog] = useState(false)
  const [showNoTasksDialog, setShowNoTasksDialog] = useState(false)
  const [noTasksPeriodName, setNoTasksPeriodName] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Vérifier l'authentification
    const role = localStorage.getItem("userRole")
    const email = localStorage.getItem("userEmail")
    const name = localStorage.getItem("userName")
    
    if (!email || !role) {
      // Pas connecté, rediriger vers la page de connexion
      router.push("/")
      return
    }
    
    if (role !== "employee") {
      // Pas un employé, rediriger vers access-denied
      router.push("/access-denied")
      return
    }
    
    setUserEmail(email)
    setUserName(name)

    // Charger les permissions de l'employé
    loadUserPermissions(email)

    // Vérifier si une session existe pour aujourd'hui
    const checkExistingSession = async () => {
      const userId = localStorage.getItem("userId") || ""
      const today = new Date().toISOString().split('T')[0]
      
      try {
        // Essayer de charger depuis la base de données d'abord
        const response = await fetch(`/api/db/work_schedules?user_id=${userId}&work_date=${today}&type=work`)
        if (response.ok) {
          const data = await response.json()
          const schedules = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : [])
          
          // Trouver une session avec une période définie (sans end_time)
          const activeSchedule = schedules.find((s: any) => 
            s.notes?.includes('Période:') && !s.end_time
          )
          
          if (activeSchedule && activeSchedule.notes?.includes('Période:')) {
            const periodMatch = activeSchedule.notes.match(/Période:\s*(matin|aprem|journee)/)
            if (periodMatch) {
              const period = periodMatch[1] as 'matin' | 'aprem' | 'journee'
              setSelectedPeriod(period)
              setCurrentView('tasks')
              return
            }
          }
        }
        
        // Fallback sur localStorage si pas de session dans la base
        const storedPeriod = localStorage.getItem(`employee_${userId}_period`)
        const storedDate = localStorage.getItem(`employee_${userId}_sessionDate`)
        
        if (storedPeriod && storedDate === today) {
          setSelectedPeriod(storedPeriod as 'matin' | 'aprem' | 'journee')
          setCurrentView('tasks')
        }
      } catch (error) {
        // Erreur silencieuse
      }
    }

    checkExistingSession()

    // Charger les salles assignées à l'employé
    loadAssignedGyms(email)

    // Restaurer l'état des pauses si existant
    const savedBreakState = localStorage.getItem("employeeBreakState")
    if (savedBreakState) {
      const breakState = JSON.parse(savedBreakState)
      setIsOnBreak(breakState.isOnBreak)
      setAccumulatedBreakTime(breakState.accumulatedBreakTime)
      if (breakState.breakStartTime) {
        setBreakStartTime(new Date(breakState.breakStartTime))
      }
    }

    // Charger les instructions de nouveau adhérent
    loadInstructions()
  }, [])
  const loadUserPermissions = async (email: string) => {
    try {
      const response = await fetch(`/api/db/users?email=${email}&single=true`)
      if (response.ok) {
        const { data } = await response.json()
        if (data) {
          setHasWorkScheduleAccess(data.has_work_schedule_access !== false)
          setHasCalendarAccess(data.has_calendar_access !== false)
          setHasWorkPeriodAccess(data.has_work_period_access !== false)
          
          // Sauvegarder le roleId pour le filtrage des tâches
          if (data.role_id) {
            setUserRoleId(data.role_id)
            localStorage.setItem("userRoleId", data.role_id)
          }
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement des permissions:", error)
    }
  }
  const loadAssignedGyms = async (email: string) => {
    try {
      const response = await fetch(`/api/employee-gyms?employeeEmail=${email}`)
      if (response.ok) {
        const { data } = await response.json()
        setAssignedGyms(data || [])
        
        // Si salle déjà sélectionnée dans localStorage, la restaurer
        const savedGymId = localStorage.getItem(`employee_${email}_selectedGym`)
        if (savedGymId && data) {
          const gym = data.find((g: any) => g.id === savedGymId)
          if (gym) {
            setSelectedGym(gym)
          }
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement des salles assignées:", error)
    }
  }

  const loadInstructions = async () => {
    try {
      // Charger les instructions
      const responseInstructions = await fetch("/api/db/new_member_instruction_items?is_active=true&orderBy=order_index&orderDir=asc")
      if (responseInstructions.ok) {
        const result = await responseInstructions.json()
        setInstructions(result.data || [])
      }

      // Charger le lien WhatsApp depuis la config
      const responseConfig = await fetch("/api/db/app_config?key=whatsapp_link")
      if (responseConfig.ok) {
        const configResult = await responseConfig.json()
        const configArray = configResult.data || []
        if (configArray.length > 0 && configArray[0].value) {
          setWhatsappLink(configArray[0].value)
        }
      }
    } catch (error) {
      // Erreur silencieuse
    }
  }

  // Sauvegarder l'état quand il change
  useEffect(() => {
    if (currentView !== "menu") {
      localStorage.setItem("employeeCurrentView", currentView)
    }
  }, [currentView])

  useEffect(() => {
    if (selectedPeriod) {
      localStorage.setItem("employeeSelectedPeriod", selectedPeriod)
    }
  }, [selectedPeriod])

  useEffect(() => {
    const breakState = {
      isOnBreak,
      accumulatedBreakTime,
      breakStartTime: breakStartTime?.toISOString() || null,
    }
    localStorage.setItem("employeeBreakState", JSON.stringify(breakState))
  }, [isOnBreak, accumulatedBreakTime, breakStartTime])

  const handleLogout = () => {
    // Nettoyer l'état de session
    localStorage.removeItem("employeeCurrentView")
    localStorage.removeItem("employeeSelectedPeriod")
    localStorage.removeItem("employeeBreakState")
    localStorage.clear()
    router.push("/")
  }

  const handleBreakStart = () => {
    setIsOnBreak(true)
    setBreakStartTime(new Date())
  }

  const handleBreakEnd = () => {
    if (breakStartTime) {
      const now = new Date()
      const sessionDuration = Math.floor((now.getTime() - breakStartTime.getTime()) / 1000 / 60)
      setAccumulatedBreakTime((prev) => prev + sessionDuration)
    }
    setIsOnBreak(false)
    setBreakStartTime(null)
  }

  const handleBreakResume = () => {
    setIsOnBreak(true)
    setBreakStartTime(new Date())
  }

  const requestPeriodSelection = (period: "matin" | "aprem" | "journee") => {
    // Vérifier si l'employé a des salles assignées
    if (assignedGyms.length === 0) {
      alert("Aucune salle ne vous est assignée. Contactez un administrateur.")
      return
    }

    // Réinitialiser la salle sélectionnée à chaque nouvelle période
    setSelectedGym(null)

    // Toujours demander de choisir la salle (même si une seule)
    setPendingPeriod(period)
    setShowGymSelectionDialog(true)
  }

  const selectGymAndContinue = (gym: any) => {
    setSelectedGym(gym)
    localStorage.setItem(`employee_${userEmail}_selectedGym`, gym.id)
    setShowGymSelectionDialog(false)
    setShowConfirmDialog(true)
  }

  const confirmPeriodSelection = async () => {
    if (pendingPeriod) {
      setShowConfirmDialog(false)
      
      // Vérifier d'abord si des tâches existent pour cette période/salle/rôle
      try {
        let tasksUrl = `/api/db/tasks?period=${pendingPeriod}`
        
        if (selectedGym?.id) {
          tasksUrl += `&gym_id=${selectedGym.id}`
        }
        
        const tasksResponse = await fetch(tasksUrl)
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json()
          let dbTasks = Array.isArray(tasksData.data) ? tasksData.data : (tasksData.data ? [tasksData.data] : [])
          
          // Filtrer pour les tâches modèles (créées par admin)
          dbTasks = dbTasks.filter((task: any) => task.created_by)
          
          // Filtrer par rôle si nécessaire
          if (userRoleId) {
            dbTasks = dbTasks.filter((task: any) => {
              if (!task.role_ids || (Array.isArray(task.role_ids) && task.role_ids.length === 0)) {
                return true
              }
              const roleIds = Array.isArray(task.role_ids) 
                ? task.role_ids 
                : (typeof task.role_ids === 'string' ? JSON.parse(task.role_ids) : [])
              return roleIds.includes(userRoleId)
            })
          }
          
          // Si aucune tâche trouvée, afficher un dialog et ne pas lancer la vue tâches
          if (dbTasks.length === 0) {
            setNoTasksPeriodName(getPeriodText(pendingPeriod))
            setShowNoTasksDialog(true)
            setPendingPeriod(null)
            setSelectedGym(null)
            return
          }
        }
      } catch (error) {
        console.error('Erreur vérification tâches:', error)
        alert('Erreur lors de la vérification des tâches. Veuillez réessayer.')
        setPendingPeriod(null)
        return
      }
      
      // Si des tâches existent, procéder normalement
      setSelectedPeriod(pendingPeriod)
      setCurrentView("tasks")
      
      // Sauvegarder la période dans la base de données
      try {
        const today = new Date().toISOString().split('T')[0]
        const userId = localStorage.getItem("userId") || ""
        
        // Créer ou mettre à jour le work_schedule
        await fetch('/api/db/work_schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              user_id: userId,
              date: today,
              start_time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              end_time: '',
              type: 'work',
              notes: `Période: ${pendingPeriod}`
            }
          })
        })
        
        // Stocker aussi en localStorage comme backup
        localStorage.setItem(`employee_${userId}_period`, pendingPeriod)
        localStorage.setItem(`employee_${userId}_sessionDate`, today)
      } catch (error) {
        // Erreur silencieuse
      }
      
      setPendingPeriod(null)
      // Reset break state for new period
      setAccumulatedBreakTime(0)
      setIsOnBreak(false)
      setBreakStartTime(null)
    }
  }

  const cancelPeriodSelection = () => {
    setShowConfirmDialog(false)
    setPendingPeriod(null)
    setSelectedGym(null)
  }

  const handleSessionEnd = () => {
    // Réinitialiser l'état de l'employé et revenir au menu
    setSelectedPeriod(null)
    setCurrentView("menu")
    setAccumulatedBreakTime(0)
    setIsOnBreak(false)
    setBreakStartTime(null)
  }

  const getPeriodEmoji = (period: "matin" | "aprem" | "journee") => {
    switch (period) {
      case "matin":
        return <Sunrise className="h-6 w-6 text-orange-500" />
      case "aprem":
        return <Sunset className="h-6 w-6 text-orange-600" />
      case "journee":
        return <Sun className="h-6 w-6 text-yellow-500" />
    }
  }

  const getPeriodText = (period: "matin" | "aprem" | "journee") => {
    switch (period) {
      case "matin":
        return "Matin"
      case "aprem":
        return "Après-midi"
      case "journee":
        return "Journée entière"
    }
  }

  const getPeriodColor = (period: "matin" | "aprem" | "journee") => {
    switch (period) {
      case "matin":
        return "bg-red-600"
      case "aprem":
        return "bg-red-600"
      case "journee":
        return "bg-red-600"
    }
  }

  // Menu principal
  if (currentView === "menu") {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white shadow-lg border-b border-gray-200 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-4xl mx-auto gap-4">
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                <HardHat className="h-6 w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Espace Employé
                </h1>
                <p className="text-sm md:text-base text-gray-600 truncate max-w-[200px] sm:max-w-none">
                  {userName} • {userEmail}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-3 w-full sm:w-auto">
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-2 border-gray-300 hover:bg-gray-50 bg-white text-sm md:text-base flex-1 sm:flex-none"
              >
                Déconnexion
              </Button>
            </div>
          </div>
        </div>

        {/* Menu de choix */}
        <div className="max-w-4xl mx-auto p-3 md:p-8">
          <Card className="shadow-2xl border border-gray-200 bg-white">
            <CardHeader className="text-center pb-4 md:pb-8">
              <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-red-600 rounded-full flex items-center justify-center mb-3 md:mb-4 shadow-lg">
                <Home className="h-7 w-7 md:h-9 md:w-9 text-white" />
              </div>
              <CardTitle className="text-2xl md:text-3xl text-gray-900">
                Que souhaitez-vous faire ?
              </CardTitle>
              <p className="text-gray-600 text-base md:text-lg mt-2">Choisissez votre action pour aujourd'hui</p>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 pb-6 md:pb-8">
              <div className="grid gap-4 md:gap-6">
                {/* Bouton Calendrier */}
                {(hasCalendarAccess || hasWorkScheduleAccess) && (
                  <Button
                    onClick={() => setCurrentView("calendar")}
                    className="h-20 md:h-24 text-lg md:text-xl bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-3 md:space-x-4 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    <Calendar className="w-8 h-8 md:w-10 md:h-10" />
                    <div className="text-left">
                      <div className="font-bold text-base md:text-xl">
                        {hasCalendarAccess && hasWorkScheduleAccess
                          ? "Calendrier & Planning"
                          : hasCalendarAccess
                          ? "Planning"
                          : "Calendrier événement"}
                      </div>
                      <div className="text-xs md:text-sm opacity-90">
                        {hasCalendarAccess && hasWorkScheduleAccess
                          ? "Événements et horaires de travail"
                          : hasCalendarAccess
                          ? "Événements et activités"
                          : "Horaires de travail"}
                      </div>
                    </div>
                  </Button>
                )}

                {/* Bouton WhatsApp */}
                {whatsappLink && (
                  <Button
                    onClick={() => window.open(whatsappLink, "_blank")}
                    className="h-16 md:h-20 text-base md:text-lg bg-green-600 hover:bg-green-700 flex items-center justify-center space-x-2 md:space-x-3 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    <MessageCircle className="w-6 h-6 md:w-8 md:h-8" />
                    <div className="text-left">
                      <div className="font-bold text-base md:text-lg">WhatsApp</div>
                      <div className="text-xs opacity-90">Groupe équipe</div>
                    </div>
                  </Button>
                )}

                {/* Section Période de Travail */}
                {hasWorkPeriodAccess && (
                  <div className="bg-red-50 p-4 md:p-6 rounded-2xl border border-red-200">
                    <h3 className="text-lg md:text-xl font-bold text-center mb-3 md:mb-4 text-gray-900">
                      Commencer ma période de travail
                    </h3>
                  <div className="grid gap-3 md:gap-4">
                    <Button
                      onClick={() => requestPeriodSelection("matin")}
                      className="h-16 md:h-20 text-base md:text-lg bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-3 md:space-x-4 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      <Sunrise className="w-7 h-7 md:w-9 md:h-9" />
                      <div className="text-left">
                        <div className="font-bold text-base md:text-lg">Matin</div>
                        <div className="text-xs md:text-sm opacity-90">Ouverture et contrôles</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => requestPeriodSelection("aprem")}
                      className="h-16 md:h-20 text-base md:text-lg bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-3 md:space-x-4 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      <Sunset className="w-7 h-7 md:w-9 md:h-9" />
                      <div className="text-left">
                        <div className="font-bold text-base md:text-lg">Après-midi</div>
                        <div className="text-xs md:text-sm opacity-90">Maintenance et nettoyage</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => requestPeriodSelection("journee")}
                      className="h-16 md:h-20 text-base md:text-lg bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-3 md:space-x-4 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      <Sun className="w-7 h-7 md:w-9 md:h-9" />
                      <div className="text-left">
                        <div className="font-bold text-base md:text-lg">Journée entière</div>
                        <div className="text-xs md:text-sm opacity-90">Ouverture à fermeture</div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dialog de sélection de salle */}
        <Dialog open={showGymSelectionDialog} onOpenChange={setShowGymSelectionDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl text-gray-900">
                Choisissez votre salle de travail
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <p className="text-sm md:text-base text-gray-600">
                Vous devez sélectionner dans quelle salle vous allez travailler pour cette session :
              </p>
              <div className="grid gap-3">
                {assignedGyms.map((gym) => (
                  <Button
                    key={gym.id}
                    onClick={() => selectGymAndContinue(gym)}
                    variant="outline"
                    className="h-auto p-4 justify-start text-left border-2 hover:border-red-600 hover:bg-red-50"
                  >
                    <div>
                      <div className="font-bold text-base">{gym.name}</div>
                      {gym.address && <div className="text-sm text-gray-600">{gym.address}</div>}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation pour le travail */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                <span>Confirmer votre période de travail</span>
              </DialogTitle>
            </DialogHeader>
            <div className="text-base md:text-lg space-y-2 text-gray-600 px-3 md:px-6 py-3 md:py-4">
              <div>
                <strong>Période :</strong>{" "}
                {pendingPeriod && getPeriodEmoji(pendingPeriod)} {pendingPeriod && getPeriodText(pendingPeriod)}
              </div>
              {selectedGym && (
                <div>
                  <strong>Salle :</strong> {selectedGym.name}
                  {selectedGym.address && <span className="text-sm"> - {selectedGym.address}</span>}
                </div>
              )}
              <div className="text-sm md:text-base text-red-700 bg-red-50 p-2 md:p-3 rounded-lg border border-red-200">
                <strong>Important :</strong> Une fois confirmé, vous ne pourrez plus changer de période jusqu'à la fin
                de votre session de travail.
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Button variant="outline" onClick={cancelPeriodSelection} className="text-base md:text-lg px-4 md:px-6 border border-gray-300 hover:bg-gray-50 bg-white w-full sm:w-auto flex items-center justify-center gap-2">
                <XCircle className="h-5 w-5" /> Annuler
              </Button>
              <Button
                onClick={confirmPeriodSelection}
                className="text-base md:text-lg px-4 md:px-6 bg-red-600 hover:bg-red-700 w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-5 w-5" /> Commencer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de sélection de salle */}
        <Dialog open={showGymSelectionDialog} onOpenChange={setShowGymSelectionDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
                <Building className="h-6 w-6 text-red-600" />
                <span>Choisissez votre salle</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">
                Plusieurs salles vous sont assignées. Sélectionnez celle où vous travaillez aujourd'hui :
              </p>
              <div className="space-y-2">
                {assignedGyms.map((gym) => (
                  <Button
                    key={gym.id}
                    onClick={() => selectGymAndContinue(gym)}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-red-50 hover:border-red-600"
                  >
                    <div className="flex items-start gap-3 w-full">
                      <Building className="h-5 w-5 mt-0.5 text-red-600" />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{gym.name}</div>
                        {gym.address && (
                          <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {gym.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog "Aucune tâche assignée" */}
        <Dialog open={showNoTasksDialog} onOpenChange={setShowNoTasksDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                <span>Aucune tâche assignée</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm md:text-base text-gray-700 mb-3">
                Aucune tâche n'a été assignée pour le créneau <strong>"{noTasksPeriodName}"</strong>.
              </p>
              <p className="text-sm text-gray-600">
                Veuillez contacter votre administrateur ou choisir un autre créneau.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => setShowNoTasksDialog(false)}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
              >
                Compris
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Vue Calendrier
  if (currentView === "calendar") {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
                {/* Header */}
        <div className="bg-white shadow-lg border-b border-gray-200 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-4xl mx-auto gap-4">
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                <HardHat className="h-6 w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Espace Employé
                </h1>
                <p className="text-sm md:text-base text-gray-600 truncate max-w-[200px] sm:max-w-none">
                  {userName} • {userEmail}
                </p>
              </div>
            </div>
            <div className="flex space-x-2 md:space-x-3 w-full sm:w-auto">
              <Button
                onClick={() => setCurrentView("menu")}
                variant="outline"
                size="sm"
                className="border-2 border-gray-300 hover:bg-gray-50 bg-white flex-1 sm:flex-none text-sm md:text-base"
              >
                🏠 Menu
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-2 border-gray-300 hover:bg-gray-50 bg-white flex-1 sm:flex-none text-sm md:text-base"
              >
                Déconnexion
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6">
          <CalendarView hasWorkScheduleAccess={hasWorkScheduleAccess} />
        </div>
      </div>
    )
  }

  // Vue Tâches (avec période sélectionnée) - SANS bouton Menu
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-4xl mx-auto gap-3">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div
              className="w-10 h-10 md:w-12 md:h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg"
            >
              {selectedPeriod ? getPeriodEmoji(selectedPeriod) : <HardHat className="h-6 w-6 md:h-7 md:w-7 text-white" />}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                {selectedPeriod ? getPeriodText(selectedPeriod) : "Mes Tâches"}
              </h1>
              <p className="text-sm md:text-base text-gray-600 truncate max-w-[200px] sm:max-w-none">
                {userName} • {userEmail}
              </p>
            </div>
          </div>
          <div className="flex space-x-2 md:space-x-3 w-full sm:w-auto">
            {/* Pas de bouton Menu ici - l'employé ne peut plus changer de période */}
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-2 border-gray-300 hover:bg-gray-50 bg-white flex-1 sm:flex-none text-sm md:text-base"
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-3 md:p-6">
        {/* En-tête de la période */}
        <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6 lg:p-8 mb-6 md:mb-8 border border-gray-200">
          <div className="flex flex-col gap-4">
            {/* Titre et salle */}
            <div className="flex items-center gap-3">
              <span className="text-3xl md:text-4xl lg:text-5xl">{selectedPeriod && getPeriodEmoji(selectedPeriod)}</span>
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">
                  To-Do List {selectedPeriod && getPeriodText(selectedPeriod)}
                </h2>
                {selectedGym && (
                  <p className="text-gray-700 mt-1 text-sm md:text-base font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {selectedGym.name}
                  </p>
                )}
              </div>
            </div>
            
            {/* Instructions et boutons */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-gray-600 text-sm md:text-base">
                  Complétez et validez chaque tâche individuellement
                </p>
                <p className="text-red-600 mt-1 text-xs md:text-sm flex items-center gap-1">
                  <Lock className="h-3 w-3 md:h-4 md:w-4" /> Session verrouillée
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:flex-shrink-0">
                <Button
                  onClick={() => setShowInstructionsDialog(true)}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white shadow-lg text-sm md:text-base w-full sm:w-auto"
                >
                  <UserPlus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Nouveau Adhérent
                </Button>
                <BreakManager
                  isOnBreak={isOnBreak}
                  breakStartTime={breakStartTime}
                  accumulatedBreakTime={accumulatedBreakTime}
                  onBreakStart={handleBreakStart}
                  onBreakEnd={handleBreakEnd}
                  onBreakResume={handleBreakResume}
                />
                <EmergencyButton />
              </div>
            </div>
          </div>
        </div>

        {selectedPeriod && <TodoList period={selectedPeriod} isBlocked={isOnBreak} gymId={selectedGym?.id} roleId={userRoleId} onSessionEnd={handleSessionEnd} />}
      </div>

      {/* Dialog pour afficher les instructions */}
      <NewMemberInstructionsDialog
        instructions={instructions}
        open={showInstructionsDialog}
        onOpenChange={setShowInstructionsDialog}
      />
    </div>
  )
}
