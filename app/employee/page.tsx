"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TodoList } from "@/components/employee/todo-list"
import { BreakManager } from "@/components/employee/break-manager"
import { EmergencyButton } from "@/components/employee/emergency-button"
import { CalendarView } from "@/components/employee/calendar-view"
import { NewMemberInstructionsDialog } from "@/components/employee/new-member-instructions-dialog"
import { useRouter } from "next/navigation"
import { MessageCircle, UserPlus } from "lucide-react"
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
  const [currentView, setCurrentView] = useState<"menu" | "tasks" | "calendar">("menu")
  const [selectedPeriod, setSelectedPeriod] = useState<"matin" | "aprem" | "journee" | null>(null)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null)
  const [accumulatedBreakTime, setAccumulatedBreakTime] = useState(0) // en minutes
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingPeriod, setPendingPeriod] = useState<"matin" | "aprem" | "journee" | null>(null)
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false)
  const [instructions, setInstructions] = useState<any[]>([])
  const [whatsappLink, setWhatsappLink] = useState("")
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

  const loadInstructions = async () => {
    try {
      // Charger les instructions
      const responseInstructions = await fetch("/api/db/new_member_instruction_items?is_active=true&orderBy=order_index&orderDir=asc")
      if (responseInstructions.ok) {
        const data = await responseInstructions.json()
        setInstructions(data || [])
      }

      // Charger le lien WhatsApp depuis la config
      const responseConfig = await fetch("/api/db/app_config?key=whatsapp_link")
      if (responseConfig.ok) {
        const configData = await responseConfig.json()
        if (configData.length > 0 && configData[0].value) {
          setWhatsappLink(configData[0].value)
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
    setPendingPeriod(period)
    setShowConfirmDialog(true)
  }

  const confirmPeriodSelection = async () => {
    if (pendingPeriod) {
      setSelectedPeriod(pendingPeriod)
      setCurrentView("tasks")
      setShowConfirmDialog(false)
      
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
        return "🌅"
      case "aprem":
        return "🌇"
      case "journee":
        return "🌞"
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
                <span className="text-xl md:text-2xl">👷‍♂️</span>
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
                <span className="text-xl md:text-2xl">🏠</span>
              </div>
              <CardTitle className="text-2xl md:text-3xl text-gray-900">
                Que souhaitez-vous faire ?
              </CardTitle>
              <p className="text-gray-600 text-base md:text-lg mt-2">Choisissez votre action pour aujourd'hui</p>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 pb-6 md:pb-8">
              <div className="grid gap-4 md:gap-6">
                {/* Bouton Calendrier */}
                <Button
                  onClick={() => setCurrentView("calendar")}
                  className="h-20 md:h-24 text-lg md:text-xl bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-3 md:space-x-4 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  <span className="text-3xl md:text-4xl">📅</span>
                  <div className="text-left">
                    <div className="font-bold text-base md:text-xl">Calendrier & Planning</div>
                    <div className="text-xs md:text-sm opacity-90">Événements et horaires de travail</div>
                  </div>
                </Button>

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

                {/* Section Travail */}
                <div className="bg-red-50 p-4 md:p-6 rounded-2xl border border-red-200">
                  <h3 className="text-lg md:text-xl font-bold text-center mb-3 md:mb-4 text-gray-900">
                    💼 Commencer ma période de travail
                  </h3>
                  <div className="grid gap-3 md:gap-4">
                    <Button
                      onClick={() => requestPeriodSelection("matin")}
                      className="h-16 md:h-20 text-base md:text-lg bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-3 md:space-x-4 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      <span className="text-2xl md:text-3xl">🌅</span>
                      <div className="text-left">
                        <div className="font-bold text-base md:text-lg">Matin</div>
                        <div className="text-xs md:text-sm opacity-90">Ouverture et contrôles</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => requestPeriodSelection("aprem")}
                      className="h-16 md:h-20 text-base md:text-lg bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-3 md:space-x-4 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      <span className="text-2xl md:text-3xl">🌇</span>
                      <div className="text-left">
                        <div className="font-bold text-base md:text-lg">Après-midi</div>
                        <div className="text-xs md:text-sm opacity-90">Maintenance et nettoyage</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => requestPeriodSelection("journee")}
                      className="h-16 md:h-20 text-base md:text-lg bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-3 md:space-x-4 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      <span className="text-2xl md:text-3xl">🌞</span>
                      <div className="text-left">
                        <div className="font-bold text-base md:text-lg">Journée entière</div>
                        <div className="text-xs md:text-sm opacity-90">Ouverture à fermeture</div>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dialog de confirmation pour le travail */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
                <span className="text-xl md:text-2xl">⚠️</span>
                <span>Confirmer votre période de travail</span>
              </DialogTitle>
            </DialogHeader>
            <div className="text-base md:text-lg space-y-2 text-gray-600 px-3 md:px-6 py-3 md:py-4">
              <div>
                Vous avez sélectionné :{" "}
                <strong>
                  {pendingPeriod && getPeriodEmoji(pendingPeriod)} {pendingPeriod && getPeriodText(pendingPeriod)}
                </strong>
              </div>
              <div className="text-sm md:text-base text-red-700 bg-red-50 p-2 md:p-3 rounded-lg border border-red-200">
                <strong>Important :</strong> Une fois confirmé, vous ne pourrez plus changer de période jusqu'à la fin
                de votre session de travail.
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Button variant="outline" onClick={cancelPeriodSelection} className="text-base md:text-lg px-4 md:px-6 border border-gray-300 hover:bg-gray-50 bg-white w-full sm:w-auto">
                ❌ Annuler
              </Button>
              <Button
                onClick={confirmPeriodSelection}
                className="text-base md:text-lg px-4 md:px-6 bg-red-600 hover:bg-red-700 w-full sm:w-auto"
              >
                ✅ Commencer
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
        <div className="bg-white shadow-lg border-b border-gray-200 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-4xl mx-auto gap-3">
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-xl md:text-2xl">📅</span>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Calendrier & Planning
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
          <CalendarView />
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
              <span className="text-xl md:text-2xl">{selectedPeriod ? getPeriodEmoji(selectedPeriod) : "👷‍♂️"}</span>
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
        <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 mb-6 md:mb-8 border border-gray-200">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold flex items-center space-x-2 md:space-x-3">
                <span className="text-3xl md:text-4xl">{selectedPeriod && getPeriodEmoji(selectedPeriod)}</span>
                <span className="text-gray-900">
                  To-Do List du {selectedPeriod && getPeriodText(selectedPeriod)}
                </span>
              </h2>
              <p className="text-gray-600 mt-2 text-sm md:text-base lg:text-lg">
                Complétez et validez chaque tâche individuellement
              </p>
              <p className="text-red-600 mt-1 text-xs md:text-sm">
                🔒 Session verrouillée - Vous ne pouvez plus changer de période
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 lg:gap-4 w-full lg:w-auto">
              <Button
                onClick={() => setShowInstructionsDialog(true)}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white shadow-lg text-sm md:text-base"
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

        {selectedPeriod && <TodoList period={selectedPeriod} isBlocked={isOnBreak} onSessionEnd={handleSessionEnd} />}
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
