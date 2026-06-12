"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { TodoList } from "@/components/employee/todo-list"
import { BreakManager } from "@/components/employee/break-manager"
import { EmergencyButton } from "@/components/employee/emergency-button"
import { CalendarView } from "@/components/employee/calendar-view"
import { SimpleTimeTracker } from "@/components/employee/simple-time-tracker"
import { WorkScheduleCalendar } from "@/components/employee/work-schedule-calendar"
import { NewMemberInstructionsDialog } from "@/components/employee/new-member-instructions-dialog"
import { CustomPageDialog } from "@/components/employee/custom-page-dialog"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MessageCircle, UserPlus, CheckCircle, XCircle, Building, MapPin, AlertTriangle, Lock, Sunrise, Sunset, Sun, CalendarDays, ChevronDown, ChevronRight, ClipboardList, LogOut, Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import * as Icons from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import dynamic from "next/dynamic"
import { fetchCurrentUser, clearCurrentUser, getUserId } from "@/lib/current-user"

// Widget de messagerie flottant (bulle en bas à droite), chargé à la demande.
const CommunicationWidget = dynamic(
  () => import("@/components/communication/communication-widget").then((m) => m.CommunicationWidget),
  { ssr: false }
)

export default function EmployeePage() {
  const [userEmail, setUserEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [userRoleId, setUserRoleId] = useState<string | null>(null)
  const [hasWorkScheduleAccess, setHasWorkScheduleAccess] = useState(false)
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false)
  const [hasWorkPeriodAccess, setHasWorkPeriodAccess] = useState(false)
  const [currentView, setCurrentView] = useState<"menu" | "tasks" | "calendar" | "schedule">("menu")
  const [selectedPeriod, setSelectedPeriod] = useState<"matin" | "aprem" | "journee" | null>(null)
  const [selectedSubPeriod, setSelectedSubPeriod] = useState<"debut" | "milieu" | "fin" | null>(null)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [activeBreakType, setActiveBreakType] = useState<"short" | "lunch" | null>(null)
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null)
  const [accumulatedBreakTime, setAccumulatedBreakTime] = useState(0) // en minutes
  const [shortBreakProgress, setShortBreakProgress] = useState(0) // en minutes pour la pause courte en cours
  const [shortBreaksCompleted, setShortBreaksCompleted] = useState(0)
  const [lunchBreakTaken, setLunchBreakTaken] = useState(false)
  const [breakScheduleId, setBreakScheduleId] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingPeriod, setPendingPeriod] = useState<"matin" | "aprem" | "journee" | null>(null)
  const [pendingSubPeriod, setPendingSubPeriod] = useState<"debut" | "milieu" | "fin" | null>(null)
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false)
  const [instructions, setInstructions] = useState<any[]>([])
  const [whatsappLink, setWhatsappLink] = useState("")
  const [assignedGyms, setAssignedGyms] = useState<any[]>([])
  const [selectedGym, setSelectedGym] = useState<any | null>(null)
  const [showGymSelectionDialog, setShowGymSelectionDialog] = useState(false)
  const [showNoTasksDialog, setShowNoTasksDialog] = useState(false)
  const [showSubPeriodRequiredDialog, setShowSubPeriodRequiredDialog] = useState(false)
  const [noTasksPeriodName, setNoTasksPeriodName] = useState("")
  const [showNoGymDialog, setShowNoGymDialog] = useState(false)
  const [showWifiRestrictionDialog, setShowWifiRestrictionDialog] = useState(false)
  const [showLogoutBlockedDialog, setShowLogoutBlockedDialog] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [customPages, setCustomPages] = useState<any[]>([])
  const [selectedCustomPage, setSelectedCustomPage] = useState<any | null>(null)
  const [showCustomPageDialog, setShowCustomPageDialog] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Vérifier l'authentification via le cookie de session (RGPD : plus de PII en localStorage)
    let cancelled = false
    const init = async () => {
      const user = await fetchCurrentUser()
      if (cancelled) return

      if (!user || !user.email || !user.role) {
        // Pas connecté, rediriger vers la page de connexion
        router.push("/")
        return
      }

      if (user.role !== "employee") {
        // Pas un employé, rediriger vers access-denied
        router.push("/access-denied")
        return
      }

      const email = user.email
      const name = user.name

      setUserEmail(email)
      setUserName(name)

      // Charger les permissions de l'employé
      loadUserPermissions(email)

    // Vérifier si une session existe pour aujourd'hui
    const checkExistingSession = async () => {
      const userId = getUserId()
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
            const subPeriodMatch = activeSchedule.notes.match(/Sous-créneau:\s*(debut|milieu|fin)/)
            if (periodMatch) {
              const period = periodMatch[1] as 'matin' | 'aprem' | 'journee'
              setSelectedPeriod(period)
              if (subPeriodMatch) {
                setSelectedSubPeriod(subPeriodMatch[1] as 'debut' | 'milieu' | 'fin')
              }
              setCurrentView('tasks')
              
              // Restaurer aussi la salle depuis la note ou le localStorage
              const gymIdMatch = activeSchedule.notes?.match(/GymId:\s*([a-zA-Z0-9-]+)/)
              if (gymIdMatch && gymIdMatch[1]) {
                // La salle sera chargée par loadAssignedGyms qui restaure depuis localStorage
                localStorage.setItem(`employee_${email}_selectedGym`, gymIdMatch[1])
              }
              return
            }
          }
        }
        
        // Fallback sur localStorage si pas de session dans la base
        const storedPeriod = localStorage.getItem(`employee_${userId}_period`)
        const storedDate = localStorage.getItem(`employee_${userId}_sessionDate`)
        
        if (storedPeriod && storedDate === today) {
          setSelectedPeriod(storedPeriod as 'matin' | 'aprem' | 'journee')
          const storedSubPeriod = localStorage.getItem(`employee_${userId}_subPeriod`)
          if (storedSubPeriod === 'debut' || storedSubPeriod === 'milieu' || storedSubPeriod === 'fin') {
            setSelectedSubPeriod(storedSubPeriod)
          }
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
      setActiveBreakType(breakState.activeBreakType || null)
      setShortBreakProgress(breakState.shortBreakProgress || 0)
      setShortBreaksCompleted(breakState.shortBreaksCompleted || 0)
      setLunchBreakTaken(Boolean(breakState.lunchBreakTaken))
      if (breakState.breakStartTime) {
        setBreakStartTime(new Date(breakState.breakStartTime))
      }
    }

    // Charger les instructions de nouveau adhérent
    loadInstructions()

    // Charger les pages personnalisées
    loadCustomPages()
    }

    init()
    return () => { cancelled = true }
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
      // Erreur silencieuse
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
      // Erreur silencieuse
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

  const loadCustomPages = async () => {
    try {
      const response = await fetch("/api/db/custom_pages?is_active=true&orderBy=order_index&orderDir=asc")
      if (response.ok) {
        const result = await response.json()
        const pages = result.data || []
        
        // Filtrer les pages selon le rôle de l'utilisateur
        const filteredPages = pages.filter((page: any) => {
          // Si roleIds est null ou vide, la page est accessible à tous
          if (!page.roleIds || (Array.isArray(page.roleIds) && page.roleIds.length === 0)) {
            return true
          }
          // Si l'utilisateur a un roleId, vérifier s'il est dans la liste
          if (userRoleId && Array.isArray(page.roleIds)) {
            return page.roleIds.includes(userRoleId)
          }
          // Par défaut, ne pas afficher la page
          return false
        })
        
        
        // Charger les items pour chaque page filtrée
        const pagesWithItems = await Promise.all(
          filteredPages.map(async (page: any) => {
            const itemsResponse = await fetch(`/api/db/custom_page_items?page_id=${page.id}&is_active=true&orderBy=order_index&orderDir=asc`)
            if (itemsResponse.ok) {
              const itemsResult = await itemsResponse.json()
              return { ...page, items: itemsResult.data || [] }
            }
            return { ...page, items: [] }
          })
        )
        
        
        // Ne garder que les pages avec au moins un item actif
        const pagesWithActiveItems = pagesWithItems.filter(page => page.items.length > 0)
        setCustomPages(pagesWithActiveItems)
      }
    } catch (error) {
    }
  }

  const handleOpenCustomPage = (page: any) => {
    setSelectedCustomPage(page)
    setShowCustomPageDialog(true)
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
    if (selectedSubPeriod) {
      localStorage.setItem("employeeSelectedSubPeriod", selectedSubPeriod)
    }
  }, [selectedSubPeriod])

  useEffect(() => {
    const breakState = {
      isOnBreak,
      activeBreakType,
      accumulatedBreakTime,
      shortBreakProgress,
      shortBreaksCompleted,
      lunchBreakTaken,
      breakStartTime: breakStartTime?.toISOString() || null,
    }
    localStorage.setItem("employeeBreakState", JSON.stringify(breakState))
  }, [isOnBreak, activeBreakType, accumulatedBreakTime, shortBreakProgress, shortBreaksCompleted, lunchBreakTaken, breakStartTime])

  const handleLogout = async () => {
    // Bloquer la déconnexion si une période de travail est active et non terminée
    if (selectedPeriod && !sessionCompleted) {
      setShowLogoutBlockedDialog(true)
      return
    }
    
    // Nettoyer l'état de session
    localStorage.removeItem("employeeCurrentView")
    localStorage.removeItem("employeeSelectedPeriod")
    localStorage.removeItem("employeeBreakState")
    await fetch('/api/auth/logout', { method: 'POST' })
    clearCurrentUser()
    localStorage.clear()
    router.push("/")
  }

  const handleBreakStart = async (type: "short" | "lunch") => {
    setIsOnBreak(true)
    setActiveBreakType(type)
    setBreakStartTime(new Date())

    try {
      const userId = getUserId()
      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const response = await fetch('/api/db/work_schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [{
            user_id: userId,
            work_date: today,
            start_time: now,
            end_time: '',
            type: 'break',
            is_temporary: true,
            notes: `Pause: ${type}`
          }]
        })
      })
      if (response.ok) {
        const result = await response.json()
        const created = Array.isArray(result.data) ? result.data[0] : result.data
        if (created?.id) setBreakScheduleId(created.id)
      }
    } catch {
      // Erreur silencieuse — la pause continue côté employé
    }
  }

  const handleBreakEnd = async () => {
    if (breakStartTime) {
      const now = new Date()
      const sessionDuration = Math.floor((now.getTime() - breakStartTime.getTime()) / 1000 / 60)
      setAccumulatedBreakTime((prev) => prev + sessionDuration)

      if (activeBreakType === "short") {
        const nextShortBreakProgress = shortBreakProgress + sessionDuration
        if (nextShortBreakProgress >= 20) {
          setShortBreaksCompleted((prev) => prev + 1)
          setShortBreakProgress(0)
        } else {
          setShortBreakProgress(nextShortBreakProgress)
        }
      }

      if (activeBreakType === "lunch") {
        setLunchBreakTaken(true)
      }

      if (breakScheduleId) {
        try {
          const endTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          await fetch(`/api/db/work_schedules/${breakScheduleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ end_time: endTime })
          })
        } catch {
          // Erreur silencieuse
        }
        setBreakScheduleId(null)
      }
    }
    setIsOnBreak(false)
    setBreakStartTime(null)
    setActiveBreakType(null)
  }

  const handleBreakResume = async (type: "short") => {
    setIsOnBreak(true)
    setActiveBreakType(type)
    setBreakStartTime(new Date())

    try {
      const userId = getUserId()
      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const response = await fetch('/api/db/work_schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [{
            user_id: userId,
            work_date: today,
            start_time: now,
            end_time: '',
            type: 'break',
            is_temporary: true,
            notes: `Pause: ${type} (reprise)`
          }]
        })
      })
      if (response.ok) {
        const result = await response.json()
        const created = Array.isArray(result.data) ? result.data[0] : result.data
        if (created?.id) setBreakScheduleId(created.id)
      }
    } catch {
      // Erreur silencieuse
    }
  }

  const requestPeriodSelection = (period: "matin" | "aprem" | "journee") => {
    // Vérifier si l'employé a des salles assignées
    if (assignedGyms.length === 0) {
      setShowNoGymDialog(true)
      return
    }

    // Réinitialiser la salle sélectionnée à chaque nouvelle période
    setSelectedGym(null)
    setPendingSubPeriod(null)

    // Toujours demander de choisir la salle (même si une seule)
    setPendingPeriod(period)
    setShowGymSelectionDialog(true)
  }

  const selectGymAndContinue = async (gym: any) => {
    // Vérifier la restriction WiFi si la salle l'exige
    if (gym.wifi_restricted) {
      try {
        const response = await fetch('/api/network-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gymId: gym.id })
        })
        const data = await response.json()
        
        if (!data.allowed) {
          setShowGymSelectionDialog(false)
          setShowWifiRestrictionDialog(true)
          return
        }
      } catch (error) {
        // En cas d'erreur réseau, bloquer par sécurité
        setShowGymSelectionDialog(false)
        setShowWifiRestrictionDialog(true)
        return
      }
    }
    
    setSelectedGym(gym)
    localStorage.setItem(`employee_${userEmail}_selectedGym`, gym.id)
    setShowGymSelectionDialog(false)
    setShowConfirmDialog(true)
  }

  const confirmPeriodSelection = async () => {
    if (pendingPeriod) {
      if ((pendingPeriod === "matin" || pendingPeriod === "aprem") && !pendingSubPeriod) {
        setShowSubPeriodRequiredDialog(true)
        return
      }

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
          
          // Filtrer par rôle si nécessaire
          if (userRoleId) {
            dbTasks = dbTasks.filter((task: any) => {
              // Si role_ids est null, undefined ou '', la tâche est visible par tous
              if (!task.role_ids || task.role_ids === '') {
                return true
              }
              
              let roleArray: string[] = []
              
              // CAS 1: C'est déjà un tableau
              if (Array.isArray(task.role_ids)) {
                roleArray = task.role_ids
              }
              // CAS 2: C'est une chaîne JSON (double sérialisation)
              else if (typeof task.role_ids === 'string') {
                try {
                  const parsed = JSON.parse(task.role_ids)
                  if (Array.isArray(parsed)) {
                    roleArray = parsed
                  } else {
                    return false
                  }
                } catch (e) {
                  return false
                }
              }
              // CAS 3: C'est un objet (Prisma Json retourne parfois comme objet)
              else if (typeof task.role_ids === 'object') {
                try {
                  roleArray = Object.values(task.role_ids)
                } catch (e) {
                  return false
                }
              }
              
              // Si le tableau est vide, visible par tous
              if (roleArray.length === 0) {
                return true
              }
              
              // Vérifier si le rôle de l'utilisateur est dans le tableau
              return roleArray.includes(userRoleId)
            })
          }

          if ((pendingPeriod === "matin" || pendingPeriod === "aprem") && pendingSubPeriod) {
            dbTasks = dbTasks.filter((task: any) => {
              if (!task.sub_period) {
                return true
              }
              return task.sub_period === pendingSubPeriod
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
        toast.error('Erreur lors de la vérification des tâches. Veuillez réessayer.')
        setPendingPeriod(null)
        setSelectedGym(null)
        return
      }
      
      // Si des tâches existent, procéder normalement
      setSelectedPeriod(pendingPeriod)
      setSelectedSubPeriod((pendingPeriod === "matin" || pendingPeriod === "aprem") ? pendingSubPeriod : null)
      setCurrentView("tasks")
      setShowConfirmDialog(false)
      
      // Sauvegarder la période dans la base de données
      try {
        const today = new Date().toISOString().split('T')[0]
        const userId = getUserId()
        
        const workScheduleData = {
          user_id: userId,
          employee_email: userEmail,
          employee_name: userName,
          date: today,
          period: pendingPeriod,
          sub_period: (pendingPeriod === "matin" || pendingPeriod === "aprem") ? pendingSubPeriod : null,
          start_time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          end_time: '',
          type: 'work',
          is_temporary: true, // Marquer comme période temporaire (sera nettoyée automatiquement)
          notes: `Période: ${pendingPeriod}${(pendingPeriod === "matin" || pendingPeriod === "aprem") && pendingSubPeriod ? ` | Sous-créneau: ${pendingSubPeriod}` : ''}${selectedGym?.id ? ` | GymId: ${selectedGym.id}` : ''}`
        }
        
        
        // Créer ou mettre à jour le work_schedule avec isTemporary = true
        const response = await fetch('/api/db/work_schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: workScheduleData
          })
        })
        
        if (response.ok) {
          const result = await response.json()
        } else {
          const error = await response.json()
        }
        
        // Stocker aussi en localStorage comme backup
        localStorage.setItem(`employee_${userId}_period`, pendingPeriod)
        if ((pendingPeriod === "matin" || pendingPeriod === "aprem") && pendingSubPeriod) {
          localStorage.setItem(`employee_${userId}_subPeriod`, pendingSubPeriod)
        } else {
          localStorage.removeItem(`employee_${userId}_subPeriod`)
        }
        localStorage.setItem(`employee_${userId}_sessionDate`, today)
        // Réinitialiser le flag de session terminée pour la nouvelle période
        setSessionCompleted(false)
      } catch (error) {
        // Erreur silencieuse
      }
      
      setPendingPeriod(null)
      setPendingSubPeriod(null)
      // Reset break state for new period
      setAccumulatedBreakTime(0)
      setIsOnBreak(false)
      setActiveBreakType(null)
      setBreakStartTime(null)
      setShortBreakProgress(0)
      setShortBreaksCompleted(0)
      setLunchBreakTaken(false)
    }
  }

  const cancelPeriodSelection = () => {
    setShowConfirmDialog(false)
    setPendingPeriod(null)
    setPendingSubPeriod(null)
    setSelectedGym(null)
  }

  const handleSessionEnd = () => {
    // Marquer la session comme terminée pour permettre la déconnexion
    setSessionCompleted(true)
    
    // Réinitialiser l'état de l'employé et revenir au menu
    setSelectedPeriod(null)
    setSelectedSubPeriod(null)
    setCurrentView("menu")
    setAccumulatedBreakTime(0)
    setIsOnBreak(false)
    setActiveBreakType(null)
    setBreakStartTime(null)
    setShortBreakProgress(0)
    setShortBreaksCompleted(0)
    setLunchBreakTaken(false)
    setSelectedGym(null)
    
    // Nettoyer les données de session du localStorage
    const userId = getUserId()
    localStorage.removeItem(`employee_${userId}_period`)
    localStorage.removeItem(`employee_${userId}_subPeriod`)
    localStorage.removeItem(`employee_${userId}_sessionDate`)
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

  const getSubPeriodText = (subPeriod: "debut" | "milieu" | "fin", period: "matin" | "aprem") => {
    if (subPeriod === "debut") {
      return "Ouverture"
    }
    if (subPeriod === "milieu") {
      return "Milieu"
    }
    return period === "matin" ? "Fin de matinée" : "Fin d'après-midi"
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

  // Rendu de la vue courante (le widget de messagerie est monté séparément,
  // de façon persistante, pour conserver la connexion temps réel).
  const renderView = () => {
    const dateStr = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    })

    const navItems = [
      {
        id: "planning" as const,
        label: "Planning",
        icon: ClipboardList,
        active: currentView === "menu" || currentView === "tasks",
        onClick: () => {
          setMobileOpen(false)
          if (selectedPeriod) setCurrentView("tasks")
          else setCurrentView("menu")
        },
      },
      {
        id: "calendar" as const,
        label: "Calendrier",
        icon: CalendarDays,
        active: currentView === "calendar",
        onClick: () => { setCurrentView("calendar"); setMobileOpen(false) },
      },
    ]

    const activeLabel = navItems.find((n) => n.active)?.label ?? "Planning"

    return (
      <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────── */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 z-40 flex-shrink-0">
          {/* Hamburger mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-800 p-1 rounded-md"
            aria-label="Ouvrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Toggle sidebar desktop */}
          <button
            onClick={() => setDesktopOpen((v) => !v)}
            className="hidden lg:flex text-gray-400 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            aria-label={desktopOpen ? "Réduire sidebar" : "Ouvrir sidebar"}
          >
            {desktopOpen
              ? <PanelLeftClose className="w-5 h-5" />
              : <PanelLeftOpen  className="w-5 h-5" />
            }
          </button>

          <div className="hidden lg:block w-px h-6 bg-gray-200" />

          {/* Logo + nom */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-red-50">
              <Image
                src="/Logo-removebg-preview.png"
                alt="FitEvo"
                width={32}
                height={32}
                className="object-contain w-full h-full"
                priority
              />
            </div>
            <span className="text-base font-extrabold text-gray-900 tracking-tight">FitEvo</span>
          </div>

          {/* Section active (mobile) */}
          <span className="lg:hidden ml-auto text-xs font-medium text-gray-500 truncate max-w-[130px]">
            {activeLabel}
          </span>

          {/* Profil (desktop droite) */}
          <div className="hidden lg:flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-gray-700 truncate max-w-[160px]">{userName}</span>
          </div>
        </header>

        {/* ── Corps (sidebar + contenu) ──────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Overlay mobile */}
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}

          {/* ── Sidebar ──────────────────────────────────────── */}
          <aside
            className={[
              "bg-white border-r border-gray-200 flex flex-col z-40 flex-shrink-0",
              "transition-all duration-300 ease-in-out overflow-hidden",
              "fixed top-0 left-0 h-full w-64",
              mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
              desktopOpen
                ? "lg:static lg:translate-x-0 lg:w-60 lg:shadow-none"
                : "lg:static lg:translate-x-0 lg:w-0 lg:border-r-0",
            ].join(" ")}
          >
            {/* Bouton fermer (mobile) */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 lg:hidden">
              <span className="text-sm font-bold text-gray-600">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profil (dans sidebar mobile) */}
            <div className="px-4 py-3 border-b border-gray-100 lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-red-50">
                  <Image
                    src="/Logo-removebg-preview.png"
                    alt="FitEvo"
                    width={32}
                    height={32}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
                  <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5 min-w-[236px]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 whitespace-nowrap">
                Espace Employé
              </p>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={[
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                    "transition-all duration-150 group whitespace-nowrap",
                    item.active
                      ? "bg-red-50 text-red-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  ].join(" ")}
                >
                  <item.icon className={[
                    "w-4 h-4 flex-shrink-0",
                    item.active ? "text-red-500" : "text-gray-400 group-hover:text-gray-600",
                  ].join(" ")} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.active && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                </button>
              ))}
            </nav>

            {/* Déconnexion */}
            <div className="px-2.5 py-3 border-t border-gray-100 min-w-[236px]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all group whitespace-nowrap"
              >
                <LogOut className="w-4 h-4 group-hover:text-red-500" />
                Déconnexion
              </button>
            </div>
          </aside>

          {/* ── Contenu principal ─────────────────────────────── */}
          <main className="flex-1 overflow-y-auto">

            {/* ── VUE PLANNING (menu + tâches) ────────────────── */}
            {(currentView === "menu" || currentView === "tasks") && (
              <>
                {/* Hero */}
                <div className="px-4 pt-5 sm:px-6 sm:pt-6">
                  <div className="relative rounded-2xl overflow-hidden h-36 sm:h-44 shadow-lg">
                    <Image
                      src="/fitevo-salle.jpg"
                      alt="Salle FitEvo"
                      fill
                      className="object-cover"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 sm:px-7 sm:pb-6">
                      <p className="text-[10px] sm:text-xs font-bold text-white/60 uppercase tracking-widest mb-1">
                        Espace Employé
                      </p>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                        Bonjour, {userName?.split(" ")[0] || "Employé"} 👋
                      </h1>
                      <p className="text-xs sm:text-sm text-white/75 mt-1 capitalize">{dateStr}</p>
                    </div>
                  </div>
                </div>

                <div className="px-4 pt-4 pb-6 sm:px-6 sm:pt-5 space-y-4">

                  {/* ── Sélection de période (pas de période active) ── */}
                  {currentView === "menu" && (
                    <>
                      {hasWorkPeriodAccess && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Commencer ma période</p>
                          <nav className="space-y-0.5">
                            {[
                              { period: "matin" as const, label: "Matin", sub: "Ouverture et contrôles", Icon: Sunrise },
                              { period: "aprem" as const, label: "Après-midi", sub: "Maintenance et nettoyage", Icon: Sunset },
                              { period: "journee" as const, label: "Journée entière", sub: "Ouverture à fermeture", Icon: Sun },
                            ].map(({ period, label, sub, Icon }) => (
                              <button
                                key={period}
                                onClick={() => requestPeriodSelection(period)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group text-gray-600 hover:bg-red-50 hover:text-red-600"
                              >
                                <Icon className="w-4 h-4 flex-shrink-0 text-gray-400 group-hover:text-red-500" />
                                <div className="flex-1 text-left">
                                  <span className="block">{label}</span>
                                  <span className="text-xs text-gray-400 font-normal">{sub}</span>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-red-400" />
                              </button>
                            ))}
                          </nav>
                        </div>
                      )}

                      {!hasWorkPeriodAccess && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-3">Pointage</p>
                          <SimpleTimeTracker />
                        </div>
                      )}

                      {whatsappLink && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Liens</p>
                          <button
                            onClick={() => window.open(whatsappLink, "_blank")}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          >
                            <MessageCircle className="w-4 h-4 flex-shrink-0 text-green-500" />
                            <div className="flex-1 text-left">
                              <span className="block">WhatsApp</span>
                              <span className="text-xs text-gray-400 font-normal">Groupe équipe</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Vue tâches (période active) ──────────────── */}
                  {currentView === "tasks" && (
                    <>
                      {/* Carte session */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-50 overflow-hidden flex items-center justify-center flex-shrink-0 p-1.5">
                              <Image src="/Logo-removebg-preview.png" alt="FitEvo" width={40} height={40} className="object-contain" />
                            </div>
                            <div>
                              <h2 className="font-bold text-gray-900 text-base">
                                To-Do List — {selectedPeriod && getPeriodText(selectedPeriod)}
                              </h2>
                              {selectedGym && (
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3" /> {selectedGym.name}
                                </p>
                              )}
                              <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                                <Lock className="h-3 w-3" /> Session verrouillée
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                            {customPages.length === 1 ? (
                              <Button
                                onClick={() => handleOpenCustomPage(customPages[0])}
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs"
                              >
                                {(() => {
                                  const IconComponent = (Icons as any)[customPages[0].icon] || Icons.FileText
                                  return <IconComponent className="w-3.5 h-3.5 mr-1.5" />
                                })()}
                                {customPages[0].title}
                              </Button>
                            ) : customPages.length > 1 ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs">
                                    <Icons.FileText className="w-3.5 h-3.5 mr-1.5" />
                                    Pages d'aide
                                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {customPages.map((page) => {
                                    const IconComponent = (Icons as any)[page.icon] || Icons.FileText
                                    return (
                                      <DropdownMenuItem key={page.id} onClick={() => handleOpenCustomPage(page)} className="cursor-pointer">
                                        <IconComponent className="w-4 h-4 mr-2" />
                                        {page.title}
                                      </DropdownMenuItem>
                                    )
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                            <BreakManager
                              period={selectedPeriod || "matin"}
                              isOnBreak={isOnBreak}
                              breakType={activeBreakType}
                              breakStartTime={breakStartTime}
                              accumulatedBreakTime={accumulatedBreakTime}
                              shortBreaksCompleted={shortBreaksCompleted}
                              shortBreakProgress={shortBreakProgress}
                              lunchBreakTaken={lunchBreakTaken}
                              onBreakStart={handleBreakStart}
                              onBreakEnd={handleBreakEnd}
                              onBreakResume={handleBreakResume}
                            />
                            <EmergencyButton />
                          </div>
                        </div>
                      </div>

                      {/* To-do list */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 md:p-6">
                        {selectedPeriod && (
                          <TodoList
                            period={selectedPeriod}
                            subPeriod={selectedSubPeriod}
                            isBlocked={isOnBreak}
                            gymId={selectedGym?.id}
                            roleId={userRoleId}
                            onSessionEnd={handleSessionEnd}
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── VUE CALENDRIER ─────────────────────────────── */}
            {currentView === "calendar" && (
              <div className="px-4 pt-4 pb-6 sm:px-6 sm:pt-5">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 md:p-6">
                  <CalendarView
                    hasWorkScheduleAccess={hasWorkScheduleAccess}
                    hasCalendarAccess={hasCalendarAccess}
                  />
                </div>
              </div>
            )}
          </main>
        </div>

        {/* ── Dialogs (communs à toutes les vues) ─────────────── */}

        {/* Sélection de salle */}
        <Dialog open={showGymSelectionDialog} onOpenChange={setShowGymSelectionDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
                <Building className="h-5 w-5 text-red-600" />
                <span>Choisissez votre salle</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">
                Plusieurs salles vous sont assignées. Sélectionnez celle où vous travaillez aujourd'hui :
              </p>
              <div className="space-y-2">
                {assignedGyms.map((gym) => (
                  <Button key={gym.id} onClick={() => selectGymAndContinue(gym)} variant="outline"
                    className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-red-50 hover:border-red-600">
                    <div className="flex items-start gap-3 w-full">
                      <Building className="h-5 w-5 mt-0.5 text-red-600" />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{gym.name}</div>
                        {gym.address && (
                          <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />{gym.address}
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

        {/* Confirmation période */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span>Confirmer votre période de travail</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm text-gray-600 py-3">
              <div>
                <strong>Période :</strong>{" "}
                {pendingPeriod && getPeriodEmoji(pendingPeriod)} {pendingPeriod && getPeriodText(pendingPeriod)}
              </div>
              {selectedGym && (
                <div>
                  <strong>Salle :</strong> {selectedGym.name}
                  {selectedGym.address && <span className="text-xs"> - {selectedGym.address}</span>}
                </div>
              )}
              {(pendingPeriod === "matin" || pendingPeriod === "aprem") && (
                <div className="space-y-2">
                  <strong>Sous-créneau :</strong>
                  <Select value={pendingSubPeriod || ""} onValueChange={(value) => setPendingSubPeriod(value as "debut" | "milieu" | "fin")}>
                    <SelectTrigger className="border-2 rounded-xl bg-white text-gray-900">
                      <SelectValue placeholder="Choisir Ouverture, Milieu ou Fin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debut">Ouverture</SelectItem>
                      <SelectItem value="milieu">Milieu</SelectItem>
                      <SelectItem value="fin">{pendingPeriod === "matin" ? "Fin de matinée" : "Fin d'après-midi"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedSubPeriod && selectedPeriod && selectedPeriod !== "journee" && (
                <div><strong>Sous-créneau actif :</strong> {getSubPeriodText(selectedSubPeriod, selectedPeriod)}</div>
              )}
              <div className="text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
                <strong>Important :</strong> Une fois confirmé, vous ne pourrez plus changer de période jusqu'à la fin de votre session.
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={cancelPeriodSelection} className="w-full sm:w-auto flex items-center justify-center gap-2 border-gray-300">
                <XCircle className="h-4 w-4" /> Annuler
              </Button>
              <Button onClick={confirmPeriodSelection} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" /> Commencer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Aucune tâche */}
        <Dialog open={showNoTasksDialog} onOpenChange={setShowNoTasksDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span>Aucune tâche assignée</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600">Aucune tâche n'a été assignée pour le créneau <strong>{noTasksPeriodName}</strong> dans la salle <strong>{selectedGym?.name || "sélectionnée"}</strong>.</p>
              <p className="text-sm text-gray-500 mt-3">Contactez un administrateur pour qu'il attribue des tâches à votre rôle pour cette période.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowNoTasksDialog(false)} className="bg-red-600 hover:bg-red-700 w-full sm:w-auto">OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sous-créneau requis */}
        <Dialog open={showSubPeriodRequiredDialog} onOpenChange={setShowSubPeriodRequiredDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span>Sous-créneau requis</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 text-sm text-gray-700">Veuillez sélectionner un sous-créneau avant de commencer votre période : Ouverture, Milieu ou Fin.</div>
            <DialogFooter>
              <Button onClick={() => setShowSubPeriodRequiredDialog(false)} className="bg-red-600 hover:bg-red-700 w-full sm:w-auto">Compris</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Restriction WiFi */}
        <Dialog open={showWifiRestrictionDialog} onOpenChange={setShowWifiRestrictionDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
                <Lock className="h-5 w-5 text-red-600" />
                <span>Accès réseau requis</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-2 text-sm text-gray-600">
              <p>Cette salle nécessite que vous soyez connecté au réseau WiFi de l'établissement.</p>
              <p className="text-gray-500">Veuillez vous connecter au WiFi de la salle et réessayer.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowWifiRestrictionDialog(false)} className="bg-red-600 hover:bg-red-700 flex-1">Compris</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Déconnexion bloquée */}
        <Dialog open={showLogoutBlockedDialog} onOpenChange={setShowLogoutBlockedDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span>Déconnexion impossible</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-2 text-sm text-gray-600">
              <p>Vous avez une période de travail en cours qui n'est pas terminée.</p>
              <p className="text-gray-500">Terminez toutes les tâches obligatoires et validez la caisse avant de vous déconnecter.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowLogoutBlockedDialog(false)} className="bg-red-600 hover:bg-red-700 flex-1">Retour aux tâches</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Aucune salle */}
        <Dialog open={showNoGymDialog} onOpenChange={setShowNoGymDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
                <Building className="h-5 w-5 text-red-600" />
                <span>Aucune salle assignée</span>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-2 text-sm text-gray-600">
              <p>Aucune salle de sport ne vous est actuellement assignée.</p>
              <p className="text-gray-500">Veuillez contacter un administrateur pour plus d'informations.</p>
            </div>
            <DialogFooter className="flex gap-2">
              {whatsappLink && (
                <Button onClick={() => window.open(whatsappLink, '_blank')} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                  <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
                </Button>
              )}
              <Button onClick={() => setShowNoGymDialog(false)} className="bg-red-600 hover:bg-red-700 flex-1">OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Instructions */}
        <NewMemberInstructionsDialog instructions={instructions} open={showInstructionsDialog} onOpenChange={setShowInstructionsDialog} />

        {/* Page personnalisée */}
        {selectedCustomPage && (
          <CustomPageDialog
            pageTitle={selectedCustomPage.title}
            pageIcon={selectedCustomPage.icon}
            pageDescription={selectedCustomPage.description}
            items={selectedCustomPage.items}
            open={showCustomPageDialog}
            onOpenChange={setShowCustomPageDialog}
          />
        )}
      </div>
    )
  }

  // Tant que l'identité n'est pas chargée (via /api/me), on n'affiche pas le
  // contenu : évite que les composants enfants (dont le widget de messagerie)
  // lisent une identité encore vide au premier rendu.
  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {renderView()}
      {/* Messagerie flottante (toujours montée → temps réel persistant) */}
      <CommunicationWidget />
    </>
  )
}
