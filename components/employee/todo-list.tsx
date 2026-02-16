"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Lock, CheckCircle, XCircle, Pause, BarChart3, FileText, PartyPopper, List as ListIcon, Hourglass, DollarSign } from "lucide-react"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { CashRegisterForm } from "./cash-register-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Task {
  id: string
  title: string
  description: string
  type: "checkbox" | "text" | "qcm"
  options?: string[]
  required: boolean
  completed: boolean
  validated: boolean
  validated_at?: string
  value?: string
}

interface TodoListProps {
  period: "matin" | "aprem" | "journee"
  isBlocked: boolean
  gymId?: string // ID de la salle sélectionnée
  roleId?: string | null // ID du rôle de l'employé
  onSessionEnd?: () => void
}

// Hook pour debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function TodoList({ period, isBlocked, gymId, roleId, onSessionEnd }: TodoListProps) {
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showCashRegisterForm, setShowCashRegisterForm] = useState(false)
  const [taskToValidate, setTaskToValidate] = useState<Task | null>(null)
  const [textValues, setTextValues] = useState<Record<string, string>>({})
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)

  // Fonction pour récupérer les tâches depuis la BDD selon la période
  const getTasksForPeriod = async (period: "matin" | "aprem" | "journee"): Promise<Task[]> => {
    try {
      // Charger les tâches "modèles" (templates) depuis l'API
      // Ces tâches sont créées par l'admin et n'ont pas de statut completed par défaut
      // On ne filtre PAS par user_id car ce sont des templates globaux
      let url = `/api/db/tasks?period=${period}`
      
      // Ajouter le filtre gym si défini
      if (gymId) {
        url += `&gym_id=${gymId}`
      }
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des tâches')
      }
      
      const data = await response.json()
      
      let dbTasks = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : [])
      
      // Filtrer pour ne garder que les tâches "modèles" (templates)
      // Les tâches templates ont soit status='pending' soit pas de status du tout
      // Les tâches complétées par les users ont status='completed'
      dbTasks = dbTasks.filter((task: any) => {
        // Garder les tâches qui ne sont pas complétées
        return !task.status || task.status === 'pending'
      })
      
      // Filtrage côté client par roleId
      if (roleId) {
        dbTasks = dbTasks.filter((task: any) => {
          // Si role_ids est null ou vide, la tâche est visible par tous
          if (!task.role_ids || (Array.isArray(task.role_ids) && task.role_ids.length === 0)) {
            return true
          }
          
          // Sinon, vérifier si le roleId de l'utilisateur est dans le tableau
          const roleIds = Array.isArray(task.role_ids) 
            ? task.role_ids 
            : (typeof task.role_ids === 'string' ? JSON.parse(task.role_ids) : [])
          return roleIds.includes(roleId)
        })
      }
      
      // Convertir les tâches de la BDD au format attendu
      return dbTasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        type: task.type as "checkbox" | "text" | "qcm",
        options: task.options ? (typeof task.options === 'string' ? JSON.parse(task.options) : task.options) : undefined,
        required: task.required,
        completed: false, // Par défaut non complété
        validated: false, // Par défaut non validé
        value: ''
      }))
    } catch (error) {
      return []
    }
  }

  const [tasks, setTasks] = useState<Task[]>([])

  // Charger les tâches depuis la base de données au démarrage et périodiquement
  useEffect(() => {
    const loadTasksFromDb = async () => {
      setIsLoadingTasks(true)
      const userId = localStorage.getItem("userId") || ""
      
      try {
        // Charger les tâches "modèles" de la BDD pour cette période/salle
        const dbTasks = await getTasksForPeriod(period)
        
        if (dbTasks.length > 0) {
          // Vérifier si l'utilisateur a déjà complété certaines de ces tâches
          // On cherche les tâches complétées par cet utilisateur pour cette période
          const userTasksUrl = `/api/db/tasks?user_id=${userId}&period=${period}&status=completed`
          
          const userResponse = await fetch(userTasksUrl)
          if (userResponse.ok) {
            const userData = await userResponse.json()
            const userTasks = Array.isArray(userData.data) ? userData.data : (userData.data ? [userData.data] : [])
            
            // Mettre à jour le statut des tâches selon les données utilisateur
            const mergedTasks = dbTasks.map(task => {
              // Chercher si l'utilisateur a complété une tâche avec le même titre
              const userTask = userTasks.find((t: any) => t.title === task.title && t.gym_id === gymId)
              if (userTask && userTask.status === 'completed') {
                return {
                  ...task,
                  completed: true,
                  validated: true,
                  validated_at: userTask.updated_at
                }
              }
              return task
            })
            
            setTasks(mergedTasks)
          } else {
            setTasks(dbTasks)
          }
        } else {
          // Aucune tâche en BDD : afficher le message "Aucune tâche assignée"
          setTasks([])
        }
      } catch (error) {
        // En cas d'erreur, afficher également "Aucune tâche"
        setTasks([])
      } finally {
        setIsLoadingTasks(false)
      }
    }
    
    loadTasksFromDb()
    
    // Recharger toutes les 30 secondes SAUF si le formulaire de caisse est ouvert
    let interval: NodeJS.Timeout | undefined
    if (!showCashRegisterForm && !showValidationDialog) {
      interval = setInterval(loadTasksFromDb, 30000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [period, showCashRegisterForm, showValidationDialog, gymId, roleId])

  const completedTasks = tasks.filter((task) => task.completed).length
  const validatedTasks = tasks.filter((task) => task.validated).length
  const totalTasks = tasks.length
  const progress = (completedTasks / totalTasks) * 100

  const updateTask = (id: string, updates: Partial<Task>) => {
    if (isBlocked) return
    const task = tasks.find((t) => t.id === id)
    if (task?.validated) return // Ne pas modifier les tâches validées
    setTasks(tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)))
  }

  const handleCheckboxChange = (id: string, checked: boolean) => {
    if (checked) {
      // Si on coche, demander confirmation pour valider
      const task = tasks.find((t) => t.id === id)
      if (task) {
        setTaskToValidate({ ...task, completed: true })
        setShowValidationDialog(true)
      }
    } else {
      // Si on décoche, juste mettre à jour
      updateTask(id, { completed: false })
    }
  }

  // Debounce pour les valeurs texte
  const debouncedTextValues = useDebounce(textValues, 1000) // 1 seconde de délai

  useEffect(() => {
    // Traiter les changements de texte après le debounce
    Object.entries(debouncedTextValues).forEach(([taskId, value]) => {
      const task = tasks.find((t) => t.id === taskId)
      if (task && task.type === "text" && !task.validated) {
        const isCompleted = value.trim() !== ""
        const hasChanged = task.value !== value

        if (hasChanged) {
          updateTask(taskId, { value, completed: isCompleted })

          // Si le texte est rempli et la tâche n'était pas déjà complétée, demander validation
          if (isCompleted && !task.completed) {
            setTaskToValidate({ ...task, value, completed: true })
            setShowValidationDialog(true)
          }
        }
      }
    })
  }, [debouncedTextValues, tasks])

  const handleTextChange = (id: string, value: string) => {
    // Mettre à jour immédiatement l'affichage
    setTextValues((prev) => ({ ...prev, [id]: value }))
  }

  const handleQcmChange = (id: string, value: string) => {
    const task = tasks.find((t) => t.id === id)
    if (task) {
      setTaskToValidate({ ...task, value, completed: true })
      setShowValidationDialog(true)
    }
  }

  const confirmValidation = async () => {
    if (!taskToValidate) return

    try {
      const validationTime = new Date().toISOString()
      const userAgent = navigator.userAgent
      const userId = localStorage.getItem("userId") || ""

      // Sauvegarder dans la base de données
      const taskData = {
        title: taskToValidate.title,
        description: taskToValidate.description || "",
        type: taskToValidate.type,
        period: period,
        status: "completed",
        user_id: userId,
        created_by: userId,
        options: taskToValidate.options ? JSON.stringify(taskToValidate.options) : null,
        required: taskToValidate.required
      }

      // Vérifier si la tâche existe déjà dans la base
      const existingTaskResponse = await fetch(`/api/db/tasks?user_id=${userId}&title=${encodeURIComponent(taskToValidate.title)}&period=${period}`)
      
      if (existingTaskResponse.ok) {
        const existingTaskData = await existingTaskResponse.json()
        const existingTask = Array.isArray(existingTaskData.data) ? existingTaskData.data[0] : existingTaskData.data
        
        if (existingTask) {
          // Mettre à jour la tâche existante
          await fetch(`/api/db/tasks/${existingTask.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
          })
        } else {
          // Créer une nouvelle tâche
          await fetch('/api/db/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: taskData })
          })
        }
      }

      // Mettre à jour la tâche localement avec validation
      setTasks(
        tasks.map((t) =>
          t.id === taskToValidate.id
            ? {
                ...taskToValidate,
                completed: true,
                validated: true,
                validated_at: validationTime,
              }
            : t,
        ),
      )

      setShowValidationDialog(false)
      setTaskToValidate(null)
      
      // Forcer un rechargement après un court délai pour s'assurer que la BDD est à jour
      setTimeout(() => {
        const loadTasksFromDb = async () => {
          const userId = localStorage.getItem("userId") || ""
          try {
            const dbTasks = await getTasksForPeriod(period)
            if (dbTasks.length > 0) {
              const userResponse = await fetch(`/api/db/tasks?user_id=${userId}&period=${period}`)
              if (userResponse.ok) {
                const userData = await userResponse.json()
                const userTasks = Array.isArray(userData.data) ? userData.data : (userData.data ? [userData.data] : [])
                const mergedTasks = dbTasks.map(task => {
                  const userTask = userTasks.find((t: any) => t.title === task.title)
                  if (userTask && userTask.status === 'completed') {
                    return {
                      ...task,
                      completed: true,
                      validated: true,
                      validated_at: userTask.updated_at
                    }
                  }
                  return task
                })
                setTasks(mergedTasks)
              }
            }
          } catch (error) {
            // Erreur silencieuse
          }
        }
        loadTasksFromDb()
      }, 500)
    } catch (error) {
      console.error("Erreur lors de la validation:", error)
    }
  }

  const cancelValidation = () => {
    setShowValidationDialog(false)
    setTaskToValidate(null)
  }

  const handleCashRegisterSubmit = async (cashData: any) => {
    try {
      const completedTasksData = tasks.filter((task) => task.completed)
      const userId = localStorage.getItem("userId") || ""
      const today = new Date().toISOString().split('T')[0]
      
      // Récupérer le temps de pause depuis le localStorage
      const breakState = localStorage.getItem("employeeBreakState")
      let totalBreakTime = 0
      if (breakState) {
        const parsed = JSON.parse(breakState)
        totalBreakTime = parsed.accumulatedBreakTime || 0
        // Si une pause est en cours, ajouter sa durée
        if (parsed.isOnBreak && parsed.breakStartTime) {
          const now = new Date()
          const breakStart = new Date(parsed.breakStartTime)
          const currentBreakDuration = Math.floor((now.getTime() - breakStart.getTime()) / 1000 / 60)
          totalBreakTime += currentBreakDuration
        }
      }

      // Mettre à jour work_schedules pour marquer la fin de la session
      const scheduleResponse = await fetch(`/api/db/work_schedules?user_id=${userId}&work_date=${today}&type=work`)
      if (scheduleResponse.ok) {
        const scheduleData = await scheduleResponse.json()
        const schedules = Array.isArray(scheduleData.data) ? scheduleData.data : (scheduleData.data ? [scheduleData.data] : [])
        
        // Trouver la session active (celle avec la période mais sans end_time)
        const activeSchedule = schedules.find((s: any) => 
          s.notes?.includes('Période:') && !s.end_time
        )
        
        if (activeSchedule) {
          // Mettre à jour avec l'heure de fin et le temps de pause
          const updatedNotes = activeSchedule.notes + ` | Pause: ${totalBreakTime} min`
          await fetch(`/api/db/work_schedules/${activeSchedule.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              end_time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              notes: updatedNotes
            })
          })
        }
      }

      // Nettoyer le localStorage
      localStorage.removeItem(`employee_${userId}_period`)
      localStorage.removeItem(`employee_${userId}_sessionDate`)

      setShowCashRegisterForm(false)
      
      // Appeler le callback pour réinitialiser la vue
      if (onSessionEnd) {
        onSessionEnd()
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi:", error)
    }
  }

  const submitTodoList = () => {
    // Ouvrir le formulaire de caisse avant l'envoi final
    setShowCashRegisterForm(true)
  }

  const allRequiredTasksValidated = tasks
    .filter((task) => task.required)
    .every((task) => task.completed && task.validated)

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-lg text-gray-900">Chargement des tâches...</span>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <Card className="border-2 border-gray-300">
        <CardContent className="p-6 text-center">
          <p className="text-gray-600 text-lg">
            Aucune tâche n'a été assignée pour cette période.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Veuillez contacter votre administrateur pour assigner des tâches.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerte si bloqué */}
      {isBlocked && (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3 text-red-700">
              <Pause className="h-8 w-8" />
              <div>
                <p className="font-bold text-lg">Pause en cours</p>
                <p>Vous ne pouvez pas modifier les tâches pendant la pause</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progression */}
      <Card className="bg-red-50 border-2 border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-6 w-6" /> Progression
            </h3>
            <div className="text-right">
              <div className="text-2xl font-bold text-red-600">
                {completedTasks}/{totalTasks}
              </div>
              <div className="text-sm text-gray-600">
                {validatedTasks} validée{validatedTasks > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <Progress value={progress} className="h-4" />
          <p className="text-center mt-2 text-gray-600 flex items-center justify-center gap-2">
            {progress === 100 ? (
              <><PartyPopper className="h-5 w-5 text-green-600" /> Toutes les tâches terminées !</>
            ) : (
              `${Math.round(progress)}% terminé`
            )}
          </p>
        </CardContent>
      </Card>

      {/* Liste des tâches */}
      <div className="space-y-4">
        {tasks.map((task, index) => (
          <Card
            key={task.id}
            className={`${isBlocked ? "opacity-50" : ""} ${
              task.validated
                ? "border-red-300 bg-red-50"
                : task.completed
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200 bg-white"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center space-x-2 text-gray-900">
                      <span>{task.title}</span>
                      {task.completed && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {task.validated && <Lock className="h-5 w-5 text-red-600" />}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      {task.required && (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                          Obligatoire
                        </span>
                      )}
                      {task.validated && (
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                          <Lock className="h-3 w-3" />
                          <span>Validée</span>
                        </span>
                      )}
                      {task.validated && task.validated_at && (
                        <span className="text-xs text-gray-500">
                          {new Date(task.validated_at).toLocaleTimeString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1 text-lg">{task.description}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {task.type === "checkbox" && (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={task.id}
                    checked={task.completed}
                    onCheckedChange={(checked) => handleCheckboxChange(task.id, checked as boolean)}
                    disabled={isBlocked || task.validated}
                    className="w-6 h-6"
                  />
                  <Label htmlFor={task.id} className="text-lg cursor-pointer text-gray-900 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" /> Marquer comme terminé
                  </Label>
                </div>
              )}

              {task.type === "text" && (
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Votre réponse :
                  </Label>
                  <Textarea
                    value={textValues[task.id] ?? task.value ?? ""}
                    onChange={(e) => handleTextChange(task.id, e.target.value)}
                    placeholder="Écrivez votre réponse ici..."
                    disabled={isBlocked || task.validated}
                    className="text-lg min-h-[100px] bg-white text-gray-900"
                  />
                  {textValues[task.id] && textValues[task.id] !== debouncedTextValues[task.id] && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <Hourglass className="h-4 w-4" /> Saisie en cours...
                    </p>
                  )}
                </div>
              )}

              {task.type === "qcm" && task.options && (
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <ListIcon className="h-5 w-5" /> Choisissez une option :
                  </Label>
                  <RadioGroup
                    value={task.value || ""}
                    onValueChange={(value) => handleQcmChange(task.id, value)}
                    disabled={isBlocked || task.validated}
                    className="space-y-3"
                  >
                    {task.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <RadioGroupItem
                          value={option}
                          id={`${task.id}-${index}`}
                          disabled={isBlocked || task.validated}
                          className="w-5 h-5"
                        />
                        <Label
                          htmlFor={`${task.id}-${index}`}
                          className="text-lg cursor-pointer text-gray-900"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bouton d'envoi */}
      {allRequiredTasksValidated && !isBlocked && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardContent className="p-6 text-center">
            <div className="space-y-4">
              <div className="text-green-700">
                <PartyPopper className="h-12 w-12 mx-auto text-green-600" />
                <p className="text-xl font-bold mt-2">Félicitations !</p>
                <p className="text-lg">Toutes les tâches obligatoires sont validées</p>
                <p className="text-sm mt-2 text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                  <DollarSign className="h-4 w-4" /> Vous devrez remplir la fiche de caisse avant l'envoi final
                </p>
              </div>
              <Button
                onClick={submitTodoList}
                className="bg-green-600 hover:bg-green-700 text-white text-xl px-8 py-4 h-auto flex items-center gap-2"
              >
                <DollarSign className="h-6 w-6" /> Remplir la fiche de caisse
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmation de validation */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="sm:max-w-md bg-white" aria-describedby="validation-description">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <Lock className="h-6 w-6 text-red-600" />
              <span>Valider la tâche</span>
            </DialogTitle>
            <DialogDescription id="validation-description" className="text-base text-gray-600">
              Confirmez la validation de cette tâche 
            </DialogDescription>
          </DialogHeader>
          <div className="text-base text-gray-600 mb-4">
            {taskToValidate && (
              <>
                Voulez-vous valider la tâche <strong>"{taskToValidate.title}"</strong> ?
                <br />
                <span className="text-red-600 font-medium">
                  Une fois validée, vous ne pourrez plus la modifier.
                </span>
                {taskToValidate.value && (
                  <div className="mt-2 p-2 bg-gray-100 rounded">
                    <strong>Votre réponse :</strong> {taskToValidate.value}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button variant="outline" onClick={cancelValidation} className="text-sm sm:text-lg px-4 sm:px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-2 w-full sm:w-auto">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5" /> Annuler
            </Button>
            <Button onClick={confirmValidation} className="bg-red-600 hover:bg-red-700 text-sm sm:text-lg px-4 sm:px-6 w-full sm:w-auto">
              <Lock className="mr-2 h-4 w-4" />
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formulaire de caisse */}
      <CashRegisterForm
        isOpen={showCashRegisterForm}
        onClose={() => setShowCashRegisterForm(false)}
        onSubmit={handleCashRegisterSubmit}
        period={period}
      />
    </div>
  )
}
