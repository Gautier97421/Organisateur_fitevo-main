"use client"

import { Label } from "@/components/ui/label"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronUp, ChevronDown, Building, AlertCircle } from "lucide-react"
import { supabase, type Task, type Gym } from "@/lib/api-client"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"

export function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [selectedGym, setSelectedGym] = useState<string>("")
  const [activePeriod, setActivePeriod] = useState<"matin" | "aprem" | "journee">("matin")
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    type: "checkbox" as const,
    options: [] as string[],
    required: true,
  })

  const loadGyms = async () => {
    try {
      const { data, error } = await supabase.from("gyms").select("*").eq("is_active", true).order("name")

      if (error) throw error
      setGyms(data || [])
      if (data && data.length > 0) {
        setSelectedGym(data[0].id)
      } else {
        // Pas de salles, arrêter le chargement
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Erreur lors du chargement des salles:", error)
      setIsLoading(false)
    }
  }

  const loadTasks = async () => {
    if (!selectedGym) return

    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("gym_id", selectedGym)
        .order("period", { ascending: true })
        .order("order_index", { ascending: true })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error("Erreur lors du chargement des tâches:", error)
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

  // Rafraîchissement automatique toutes les 5 secondes
  useAutoRefresh(() => {
    loadGyms()
    if (selectedGym) {
      loadTasks()
    }
  }, 5000, [selectedGym])

  const getCurrentTasks = () => {
    return tasks.filter((task) => task.period === activePeriod)
  }

  const addTask = async () => {
    if (!newTask.title || !newTask.description || !selectedGym) return

    try {
      const currentTasks = getCurrentTasks()
      const maxOrder = Math.max(...currentTasks.map((t) => t.order_index), 0)

      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            title: newTask.title,
            description: newTask.description,
            type: newTask.type,
            period: activePeriod,
            options: newTask.type === "qcm" ? newTask.options : null,
            required: newTask.required,
            order_index: maxOrder + 1,
            gym_id: selectedGym,
          },
        ])
        .select()

      if (error) throw error

      if (data) {
        setTasks([...tasks, ...data])
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
      console.error("Erreur lors de l'ajout de la tâche:", error)
      alert("Erreur lors de l'ajout de la tâche")
    }
  }

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id)

      if (error) throw error

      setTasks(tasks.filter((task) => task.id !== id))
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
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
      await supabase.from("tasks").update({ order_index: taskToSwap.order_index }).eq("id", taskToMove.id)
      await supabase.from("tasks").update({ order_index: taskToMove.order_index }).eq("id", taskToSwap.id)

      // Recharger les tâches
      loadTasks()
    } catch (error) {
      console.error("Erreur lors du déplacement:", error)
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
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          📝 Gestion des To-Do Lists
        </h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-lg px-8 py-4 h-auto rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105"
        >
          ➕ Nouvelle Tâche
        </Button>
      </div>

      {/* Sélecteur de salle */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Building className="h-6 w-6 text-blue-600" />
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
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                  : "border-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              }`}
            >
              🌅 Matin ({getPeriodCount("matin")} tâches)
            </Button>
            <Button
              variant={activePeriod === "aprem" ? "default" : "outline"}
              onClick={() => setActivePeriod("aprem")}
              className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
                activePeriod === "aprem"
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
                  : "border-2 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              }`}
            >
              🌇 Après-midi ({getPeriodCount("aprem")} tâches)
            </Button>
            <Button
              variant={activePeriod === "journee" ? "default" : "outline"}
              onClick={() => setActivePeriod("journee")}
              className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
                activePeriod === "journee"
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                  : "border-2 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              }`}
            >
              🌞 Journée ({getPeriodCount("journee")} tâches)
            </Button>
          </div>

          {/* Formulaire d'ajout */}
          {showForm && (
            <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
              <CardHeader className={`bg-gradient-to-r ${getPeriodColor(activePeriod)} text-white rounded-t-xl`}>
                <CardTitle className="text-xl">
                  Ajouter une tâche à {selectedGymName} -{" "}
                  {activePeriod === "matin" ? "🌅 Matin" : activePeriod === "aprem" ? "🌇 Après-midi" : "🌞 Journée"}
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
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-lg px-8 py-3 rounded-xl shadow-lg"
                  >
                    ✅ Ajouter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="text-lg px-8 py-3 border-2 rounded-xl"
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
              className={`text-2xl font-semibold bg-gradient-to-r ${getPeriodColor(activePeriod)} bg-clip-text text-transparent`}
            >
              {activePeriod === "matin"
                ? "🌅 Tâches du Matin"
                : activePeriod === "aprem"
                  ? "🌇 Tâches de l'Après-midi"
                  : "🌞 Tâches de la Journée"}{" "}
              - {selectedGymName}
            </h3>

            {currentTasks.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300 bg-gray-50/50 dark:bg-gray-800/50">
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
                  className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 hover:shadow-2xl transition-all duration-200"
                >
                  <CardContent className="p-8">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-4">
                          <div
                            className={`w-12 h-12 bg-gradient-to-r ${getPeriodColor(activePeriod)} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                          >
                            #{index + 1}
                          </div>
                          <div>
                            <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">{task.title}</h3>
                            <div className="flex items-center space-x-3 mt-2">
                              {task.required && (
                                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                                  Obligatoire
                                </span>
                              )}
                              <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-sm">
                                {task.type === "checkbox" ? "☑️ Case" : task.type === "text" ? "📝 Texte" : "📋 QCM"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-lg mb-4">{task.description}</p>
                        {task.options && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                            <strong className="text-blue-800 dark:text-blue-300">Choix disponibles :</strong>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {task.options.map((option, idx) => (
                                <span
                                  key={idx}
                                  className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
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
                          className="border-2 rounded-xl p-2"
                          title="Monter"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => moveTask(task.id, "down")}
                          disabled={index === currentTasks.length - 1}
                          className="border-2 rounded-xl p-2"
                          title="Descendre"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => deleteTask(task.id)}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-red-200 hover:border-red-300 rounded-xl p-2"
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
