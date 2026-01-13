"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Lock } from "lucide-react"
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

export function TodoList({ period, isBlocked }: TodoListProps) {
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showCashRegisterForm, setShowCashRegisterForm] = useState(false)
  const [taskToValidate, setTaskToValidate] = useState<Task | null>(null)
  const [textValues, setTextValues] = useState<Record<string, string>>({})

  // Fonction pour récupérer les tâches selon la période
  const getTasksForPeriod = (period: "matin" | "aprem" | "journee"): Task[] => {
    const morningTasks = [
      {
        id: "m1",
        title: "Ouverture de la salle",
        description: "Vérifier l'éclairage et la ventilation",
        type: "checkbox" as const,
        required: true,
        completed: false,
        validated: false,
      },
      {
        id: "m2",
        title: "Contrôle des équipements",
        description: "Vérifier le bon fonctionnement des machines",
        type: "checkbox" as const,
        required: true,
        completed: false,
        validated: false,
      },
      {
        id: "m3",
        title: "Température vestiaires",
        description: "Noter la température des vestiaires",
        type: "text" as const,
        required: true,
        completed: false,
        validated: false,
        value: "",
      },
    ]

    const afternoonTasks = [
      {
        id: "a1",
        title: "Nettoyage intermédiaire",
        description: "État de propreté en milieu de journée",
        type: "qcm" as const,
        options: ["Très propre", "Propre", "À nettoyer", "Sale"],
        required: true,
        completed: false,
        validated: false,
        value: "",
      },
      {
        id: "a2",
        title: "Vérification matériel",
        description: "Contrôler l'usure des équipements",
        type: "checkbox" as const,
        required: true,
        completed: false,
        validated: false,
      },
      {
        id: "a3",
        title: "Incidents de la journée",
        description: "Rapporter tout incident ou problème",
        type: "text" as const,
        required: false,
        completed: false,
        validated: false,
        value: "",
      },
    ]

    const fullDayTasks = [
      {
        id: "f1",
        title: "Fermeture sécurisée",
        description: "Vérifier toutes les fermetures",
        type: "checkbox" as const,
        required: true,
        completed: false,
        validated: false,
      },
      {
        id: "f2",
        title: "Bilan de la journée",
        description: "Évaluation générale de la journée",
        type: "qcm" as const,
        options: ["Excellente", "Bonne", "Correcte", "Difficile"],
        required: true,
        completed: false,
        validated: false,
        value: "",
      },
      {
        id: "f3",
        title: "Remarques générales",
        description: "Commentaires ou suggestions",
        type: "text" as const,
        required: false,
        completed: false,
        validated: false,
        value: "",
      },
    ]

    switch (period) {
      case "matin":
        return morningTasks
      case "aprem":
        return afternoonTasks
      case "journee":
        return fullDayTasks
    }
  }

  const [tasks, setTasks] = useState<Task[]>(() => getTasksForPeriod(period))

  useEffect(() => {
    setTasks(getTasksForPeriod(period))
  }, [period])

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

      console.log("🔒 Validation de la tâche:", {
        taskId: taskToValidate.id,
        title: taskToValidate.title,
        value: taskToValidate.value,
        validated_at: validationTime,
        user_agent: userAgent,
        employee: localStorage.getItem("userEmail"),
      })

      // Mettre à jour la tâche avec validation
      setTasks(
        tasks.map((t) =>
          t.id === taskToValidate.id
            ? {
                ...taskToValidate,
                validated: true,
                validated_at: validationTime,
              }
            : t,
        ),
      )

      setShowValidationDialog(false)
      setTaskToValidate(null)
      alert("✅ Tâche validée ! Elle ne peut plus être modifiée.")
    } catch (error) {
      console.error("Erreur lors de la validation:", error)
      alert("Erreur lors de la validation")
    }
  }

  const cancelValidation = () => {
    setShowValidationDialog(false)
    setTaskToValidate(null)
  }

  const handleCashRegisterSubmit = async (cashData: any) => {
    try {
      const completedTasksData = tasks.filter((task) => task.completed)

      console.log("Envoi de la to-do list avec fiche de caisse:", {
        period,
        tasks: completedTasksData,
        cashRegister: cashData,
        timestamp: new Date().toISOString(),
        employee: localStorage.getItem("userEmail"),
      })

      setShowCashRegisterForm(false)
      alert("✅ To-do list et fiche de caisse envoyées avec succès !")
    } catch (error) {
      console.error("Erreur lors de l'envoi:", error)
      alert("Erreur lors de l'envoi")
    }
  }

  const submitTodoList = () => {
    // Ouvrir le formulaire de caisse avant l'envoi final
    setShowCashRegisterForm(true)
  }

  const allRequiredTasksValidated = tasks
    .filter((task) => task.required)
    .every((task) => task.completed && task.validated)

  return (
    <div className="space-y-6">
      {/* Alerte si bloqué */}
      {isBlocked && (
        <Card className="border-2 border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3 text-orange-700 dark:text-orange-300">
              <span className="text-2xl">⏸️</span>
              <div>
                <p className="font-bold text-lg">Pause en cours</p>
                <p>Vous ne pouvez pas modifier les tâches pendant la pause</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progression */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">📊 Progression</h3>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {completedTasks}/{totalTasks}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {validatedTasks} validée{validatedTasks > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <Progress value={progress} className="h-4" />
          <p className="text-center mt-2 text-gray-600 dark:text-gray-400">
            {progress === 100 ? "🎉 Toutes les tâches terminées !" : `${Math.round(progress)}% terminé`}
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
                ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600"
                : task.completed
                  ? "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-600"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">#{index + 1}</span>
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                      <span>{task.title}</span>
                      {task.completed && <span className="text-green-600">✅</span>}
                      {task.validated && <Lock className="h-5 w-5 text-blue-600" />}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      {task.required && (
                        <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 rounded-full text-sm font-medium">
                          Obligatoire
                        </span>
                      )}
                      {task.validated && (
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                          <Lock className="h-3 w-3" />
                          <span>Validée</span>
                        </span>
                      )}
                      {task.validated && task.validated_at && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(task.validated_at).toLocaleTimeString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">{task.description}</p>
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
                  <Label htmlFor={task.id} className="text-lg cursor-pointer text-gray-900 dark:text-gray-100">
                    ✅ Marquer comme terminé
                  </Label>
                </div>
              )}

              {task.type === "text" && (
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-900 dark:text-gray-100">📝 Votre réponse :</Label>
                  <Textarea
                    value={textValues[task.id] ?? task.value ?? ""}
                    onChange={(e) => handleTextChange(task.id, e.target.value)}
                    placeholder="Écrivez votre réponse ici..."
                    disabled={isBlocked || task.validated}
                    className="text-lg min-h-[100px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  {textValues[task.id] && textValues[task.id] !== debouncedTextValues[task.id] && (
                    <p className="text-sm text-blue-600 dark:text-blue-400">⏳ Saisie en cours...</p>
                  )}
                </div>
              )}

              {task.type === "qcm" && task.options && (
                <div className="space-y-3">
                  <Label className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    📋 Choisissez une option :
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
                          className="text-lg cursor-pointer text-gray-900 dark:text-gray-100"
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
        <Card className="border-2 border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-600">
          <CardContent className="p-6 text-center">
            <div className="space-y-4">
              <div className="text-green-700 dark:text-green-400">
                <span className="text-3xl">🎉</span>
                <p className="text-xl font-bold mt-2">Félicitations !</p>
                <p className="text-lg">Toutes les tâches obligatoires sont validées</p>
                <p className="text-sm mt-2 text-amber-600 dark:text-amber-400">
                  💰 Vous devrez remplir la fiche de caisse avant l'envoi final
                </p>
              </div>
              <Button
                onClick={submitTodoList}
                className="bg-green-600 hover:bg-green-700 text-white text-xl px-8 py-4 h-auto"
              >
                💰 Remplir la fiche de caisse
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmation de validation */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <Lock className="h-6 w-6 text-blue-600" />
              <span>Valider la tâche</span>
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600 dark:text-gray-300">
              {taskToValidate && (
                <>
                  Voulez-vous valider la tâche <strong>"{taskToValidate.title}"</strong> ?
                  <br />
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Une fois validée, vous ne pourrez plus la modifier.
                  </span>
                  {taskToValidate.value && (
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      <strong>Votre réponse :</strong> {taskToValidate.value}
                    </div>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-3">
            <Button variant="outline" onClick={cancelValidation} className="text-lg px-6 bg-transparent">
              ❌ Annuler
            </Button>
            <Button onClick={confirmValidation} className="bg-blue-600 hover:bg-blue-700 text-lg px-6">
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
