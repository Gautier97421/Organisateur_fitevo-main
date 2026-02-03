"use client"

import { Label } from "@/components/ui/label"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronUp, ChevronDown, Building, AlertCircle } from "lucide-react"
import { type Task, type Gym } from "@/lib/api-client"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"

// Type local pour les tâches avec tous les champs nécessaires
interface TaskItem {
  id: string
  title: string
  description?: string
  status: string
  period: "matin" | "aprem" | "journee"
  order_index: number
  gym_id: string
  type?: string
  options?: string[]
  required?: boolean
  created_at: string
}

export function TaskManager() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [selectedGym, setSelectedGym] = useState<string>("")
  const [activePeriod, setActivePeriod] = useState<"matin" | "aprem" | "journee">("matin")
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [newTask, setNewTask] = useState<{
    title: string
    description: string
    type: "checkbox" | "text" | "qcm"
    options: string[]
    required: boolean
  }>({
    title: "",
    description: "",
    type: "checkbox",
    options: [],
    required: true,
  })

  const loadGyms = async () => {
    try {
      const response = await fetch('/api/db/gyms?is_active=true&orderBy=name')
      if (!response.ok) throw new Error('Erreur chargement salles')
      
      const result = await response.json()
      const gymsData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])
      
      setGyms(gymsData)
      if (gymsData && gymsData.length > 0) {
        setSelectedGym(gymsData[0].id)
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
    }
  }

  const loadTasks = async () => {
    if (!selectedGym) return

    try {
      const response = await fetch(`/api/db/tasks?gym_id=${selectedGym}&orderBy=order_index`)
      if (!response.ok) throw new Error('Erreur chargement tâches')
      
      const result = await response.json()
      const tasksData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])
      
      // Trier côté client par period puis order_index
      const sortedTasks = tasksData.sort((a: any, b: any) => {
        const periodOrder: any = { matin: 1, aprem: 2, journee: 3 }
        if (a.period !== b.period) {
          return (periodOrder[a.period] || 0) - (periodOrder[b.period] || 0)
        }
        return a.order_index - b.order_index
      })
      
      setTasks(sortedTasks)
    } catch (error) {
      // Erreur silencieuse pour ne pas surcharger la console
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGyms()
  }, [])

  useEffect(() => {
    if (selectedGym) {
      loadTasks()
    }
  }, [selectedGym])

  // Rafraîchissement automatique toutes les 15 secondes
  useAutoRefresh(() => {
    if (selectedGym) {
      loadTasks()
    }
  }, 15000, [selectedGym])

  const getCurrentTasks = () => {
    return tasks.filter((task) => task.period === activePeriod)
  }

  const addTask = async () => {
    if (!newTask.title || !newTask.description || !selectedGym) return

    try {
      const currentTasks = getCurrentTasks()
      const maxOrder = currentTasks.length > 0 
        ? Math.max(...currentTasks.map((t) => t.order_index || 0)) 
        : 0
      const userId = localStorage.getItem("userId")
      
      if (!userId) {
        alert("Erreur: Utilisateur non identifié. Veuillez vous reconnecter.")
        return
      }

      const response = await fetch('/api/db/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            title: newTask.title,
            description: newTask.description,
            type: newTask.type,
            period: activePeriod,
            options: newTask.type === "qcm" ? JSON.stringify(newTask.options) : null,
            required: newTask.required,
            order_index: maxOrder + 1,
            gym_id: selectedGym,
            user_id: userId,
            created_by: userId,
            status: 'pending'
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(JSON.stringify(errorData, null, 2))
      }

      const result = await response.json()
      if (result.data) {
        setTasks([...tasks, result.data])
      }

      setNewTask({
        title: "",
        description: "",
        type: "checkbox",
        options: [],
        required: true,
      })
      setShowForm(false)
    } catch (error) {
      alert(`Erreur lors de l'ajout de la tâche:\n${error}`)
    }
  }

  const deleteTask = async (id: string) => {
    try {
      const response = await fetch(`/api/db/tasks/${id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Erreur suppression')

      setTasks(tasks.filter((task) => task.id !== id))
    } catch (error) {
      alert("Erreur lors de la suppression")
    }
  }

  const moveTask = async (taskId: string, direction: "up" | "down") => {
    const currentTasks = getCurrentTasks().sort((a, b) => a.order_index - b.order_index)
    const taskIndex = currentTasks.findIndex((t) => t.id === taskId)

    if ((direction === "up" && taskIndex === 0) || (direction === "down" && taskIndex === currentTasks.length - 1)) {
      return
    }

    const newIndex = direction === "up" ? taskIndex - 1 : taskIndex + 1
    const taskToMove = currentTasks[taskIndex]
    const taskToSwap = currentTasks[newIndex]

    try {
      // Échanger les order_index
      await fetch(`/api/db/tasks/${taskToMove.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: taskToSwap.order_index })
      })
      
      await fetch(`/api/db/tasks/${taskToSwap.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: taskToMove.order_index })
      })

      // Recharger les tâches
      loadTasks()
    } catch (error) {
      alert("Erreur lors du déplacement de la tâche")
    }
  }

  const getPeriodColor = (period: string) => {
    switch (period) {
      case "matin":
        return "from-blue-500 to-cyan-500"
      case "aprem":
        return "from-orange-500 to-red-500"
      case "journee":
        return "from-purple-500 to-pink-500"
      default:
        return "from-gray-500 to-gray-600"
    }
  }

  const getPeriodCount = (period: "matin" | "aprem" | "journee") => {
    return tasks.filter((task) => task.period === period).length
  }

  const currentTasks = getCurrentTasks().sort((a, b) => a.order_index - b.order_index)
  const selectedGymName = gyms.find((g) => g.id === selectedGym)?.name || ""

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-lg">Chargement des tâches...</span>
      </div>
    )
  }

  // Afficher un message si aucune salle n'existe
  if (gyms.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Card className="max-w-md border-2 border-gray-300 bg-white">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-gray-400 mx-auto" />
            <p className="text-lg text-gray-700">
              Cette option n'est pas disponible sans avoir de salle
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">
          📝 Gestion des To-Do Lists
        </h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-4 h-auto rounded-xl shadow-lg transition-all duration-200"
        >
          ➕ Nouvelle Tâche
        </Button>
      </div>

      {/* Sélecteur de salle */}
      <Card className="border-0 shadow-xl bg-white">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Building className="h-6 w-6 text-red-600" />
            <div className="flex-1">
              <Label className="text-lg font-medium">Salle sélectionnée :</Label>
              <Select value={selectedGym} onValueChange={setSelectedGym}>
                <SelectTrigger className="h-12 text-lg border-2 rounded-xl mt-2">
                  <SelectValue placeholder="Choisir une salle" />
                </SelectTrigger>
                <SelectContent>
                  {gyms.map((gym) => (
                    <SelectItem key={gym.id} value={gym.id}>
                      🏢 {gym.name} - {gym.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedGym && (
        <>
          {/* Navigation entre les périodes */}
          <div className="flex space-x-4">
            <Button
              variant={activePeriod === "matin" ? "default" : "outline"}
              onClick={() => setActivePeriod("matin")}
              className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
                activePeriod === "matin"
                  ? "bg-red-600 text-white shadow-lg hover:bg-red-700"
                  : "border-2 hover:bg-gray-50 border-gray-300 bg-white"
              }`}
            >
              Matin ({getPeriodCount("matin")} tâches)
            </Button>
            <Button
              variant={activePeriod === "aprem" ? "default" : "outline"}
              onClick={() => setActivePeriod("aprem")}
              className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
                activePeriod === "aprem"
                  ? "bg-red-600 text-white shadow-lg hover:bg-red-700"
                  : "border-2 hover:bg-gray-50 border-gray-300 bg-white"
              }`}
            >
              Après-midi ({getPeriodCount("aprem")} tâches)
            </Button>
            <Button
              variant={activePeriod === "journee" ? "default" : "outline"}
              onClick={() => setActivePeriod("journee")}
              className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
                activePeriod === "journee"
                  ? "bg-red-600 text-white shadow-lg hover:bg-red-700"
                  : "border-2 hover:bg-gray-50 border-gray-300 bg-white"
              }`}
            >
              Journée ({getPeriodCount("journee")} tâches)
            </Button>
          </div>

          {/* Formulaire d'ajout */}
          {showForm && (
            <Card className="border-0 shadow-2xl bg-white">
              <CardHeader className="bg-red-600 text-white rounded-t-xl">
                <CardTitle className="text-xl">
                  Ajouter une tâche à {selectedGymName} -{" "}
                  {activePeriod === "matin" ? "Matin" : activePeriod === "aprem" ? "Après-midi" : "Journée"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <Input
                  placeholder="Titre de la tâche"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="text-lg h-14 border-2 rounded-xl"
                />

                <Textarea
                  placeholder="Description détaillée"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="text-lg border-2 rounded-xl min-h-[100px]"
                />

                <div className="grid grid-cols-2 gap-6">
                  <Select
                    value={newTask.type}
                    onValueChange={(value) => setNewTask({ ...newTask, type: value as any })}
                  >
                    <SelectTrigger className="h-14 text-lg border-2 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checkbox">☑️ Case à cocher</SelectItem>
                      <SelectItem value="text">📝 Texte libre</SelectItem>
                      <SelectItem value="qcm">📋 Choix multiple</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
                    <input
                      type="checkbox"
                      id="required"
                      checked={newTask.required}
                      onChange={(e) => setNewTask({ ...newTask, required: e.target.checked })}
                      className="w-6 h-6 text-blue-600 rounded"
                    />
                    <label htmlFor="required" className="text-lg font-medium">
                      Tâche obligatoire
                    </label>
                  </div>
                </div>

                {newTask.type === "qcm" && (
                  <Textarea
                    placeholder="Options (une par ligne)&#10;Option 1&#10;Option 2&#10;Option 3"
                    value={newTask.options.join("\n")}
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        options: e.target.value.split("\n").filter((opt) => opt.trim()),
                      })
                    }
                    className="text-lg border-2 rounded-xl"
                  />
                )}

                <div className="flex space-x-4">
                  <Button
                    onClick={addTask}
                    className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-3 rounded-xl shadow-lg"
                  >
                    ✅ Ajouter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="text-lg px-8 py-3 border-2 rounded-xl border-gray-300 hover:bg-gray-50 bg-white"
                  >
                    ❌ Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liste des tâches */}
          <div className="space-y-6">
            <h3
              className="text-2xl font-semibold text-gray-900"
            >
              {activePeriod === "matin"
                ? "Tâches du Matin"
                : activePeriod === "aprem"
                  ? "Tâches de l'Après-midi"
                  : "Tâches de la Journée"}{" "}
              - {selectedGymName}
            </h3>

            {currentTasks.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
                <CardContent className="p-12 text-center text-gray-500">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-xl mb-2">Aucune tâche dans cette to-do list</p>
                  <p className="text-lg">Cliquez sur "Nouvelle Tâche" pour en ajouter une</p>
                </CardContent>
              </Card>
            ) : (
              currentTasks.map((task, index) => (
                <Card
                  key={task.id}
                  className="border-0 shadow-xl bg-white hover:shadow-2xl transition-all duration-200"
                >
                  <CardContent className="p-8">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-4">
                          <div
                            className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                          >
                            #{index + 1}
                          </div>
                          <div>
                            <h3 className="text-2xl font-semibold text-gray-800">{task.title}</h3>
                            <div className="flex items-center space-x-3 mt-2">
                              {task.required && (
                                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                                  Obligatoire
                                </span>
                              )}
                              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                                {task.type === "checkbox" ? "☑️ Case" : task.type === "text" ? "📝 Texte" : "📋 QCM"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-600 text-lg mb-4">{task.description}</p>
                        {task.options && (
                          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                            <strong className="text-red-800">Choix disponibles :</strong>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {task.options.map((option, idx) => (
                                <span
                                  key={idx}
                                  className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm"
                                >
                                  {option}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        {/* Boutons de réorganisation */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => moveTask(task.id, "up")}
                          disabled={index === 0}
                          className="border-2 rounded-xl p-2 border-gray-300 hover:bg-gray-50 bg-white"
                          title="Monter"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => moveTask(task.id, "down")}
                          disabled={index === currentTasks.length - 1}
                          className="border-2 rounded-xl p-2 border-gray-300 hover:bg-gray-50 bg-white"
                          title="Descendre"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => deleteTask(task.id)}
                          className="text-red-600 hover:bg-red-50 border-2 border-red-200 hover:border-red-300 rounded-xl p-2 bg-white"
                          title="Supprimer"
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
