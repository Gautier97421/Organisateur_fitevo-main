"use client"

import { Label } from "@/components/ui/label"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GripVertical, Building, AlertCircle, ListTodo, Plus, CheckSquare2, FileText, List, CheckCircle, XCircle, Trash2, Pencil } from "lucide-react"
import { type Task, type Gym } from "@/lib/api-client"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Type local pour les tâches avec tous les champs nécessaires
interface TaskItem {
  id: string
  title: string
  description?: string
  status: string
  period: "matin" | "aprem" | "journee"
  order_index: number
  gym_id: string
  role_ids?: string[] // IDs des rôles autorisés
  type?: string
  options?: string[]
  required?: boolean
  created_at: string
}

interface Role {
  id: string
  name: string
  color: string
}

// Composant SortableTaskItem pour le drag and drop
function SortableTaskItem({ task, index, roles, onDelete, onEdit }: { task: TaskItem; index: number; roles: Role[]; onDelete: (id: string) => void; onEdit: (task: TaskItem) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="border-0 shadow-md bg-white dark:bg-gray-800 hover:shadow-lg transition-all duration-200"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-600 dark:bg-red-700 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                #{index + 1}
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white truncate">{task.title}</h3>
              {task.required && (
                <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
                  Obligatoire
                </span>
              )}
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs flex-shrink-0">
                {task.type === "checkbox" ? <CheckSquare2 className="h-3 w-3" /> : task.type === "text" ? <FileText className="h-3 w-3" /> : <List className="h-3 w-3" />}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">{task.description}</p>
            {task.role_ids && task.role_ids.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {task.role_ids.map((roleId) => {
                  const role = roles.find((r) => r.id === roleId)
                  return role ? (
                    <span
                      key={roleId}
                      className="px-2 py-0.5 rounded-full text-xs text-white font-medium"
                      style={{ backgroundColor: role.color }}
                    >
                      {role.name}
                    </span>
                  ) : null
                })}
              </div>
            )}
            {task.options && task.options.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {task.options.slice(0, 3).map((option, idx) => (
                  <span
                    key={idx}
                    className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-2 py-0.5 rounded-full text-xs"
                  >
                    {option}
                  </span>
                ))}
                {task.options.length > 3 && (
                  <span className="text-gray-500 dark:text-gray-400 text-xs">+{task.options.length - 3}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(task)}
              className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800 flex-shrink-0"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(task.id)}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800 flex-shrink-0"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TaskManager() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedGym, setSelectedGym] = useState<string>("")
  const [selectedRole, setSelectedRole] = useState<string>("all") // "all" pour tous les rôles
  const [activePeriod, setActivePeriod] = useState<"matin" | "aprem" | "journee">("matin")
  const [showForm, setShowForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [newTask, setNewTask] = useState<{
    title: string
    description: string
    type: "checkbox" | "text" | "qcm"
    options: string[]
    required: boolean
    roleIds: string[] // IDs des rôles sélectionnés
  }>({
    title: "",
    description: "",
    type: "checkbox",
    options: [],
    required: true,
    roleIds: [],
  })
  const [editTask, setEditTask] = useState<{
    title: string
    description: string
    type: "checkbox" | "text" | "qcm"
    options: string[]
    required: boolean
    roleIds: string[]
  }>({
    title: "",
    description: "",
    type: "checkbox",
    options: [],
    required: true,
    roleIds: [],
  })

  // Configuration drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/roles')
      if (!response.ok) throw new Error('Erreur chargement rôles')
      
      const result = await response.json()
      setRoles(result.data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des rôles:', error)
    }
  }

  const loadTasks = async () => {
    if (!selectedGym) return

    try {
      const response = await fetch(`/api/db/tasks?gym_id=${selectedGym}&orderBy=order_index`)
      if (!response.ok) throw new Error('Erreur chargement tâches')
      
      const result = await response.json()
      const tasksData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])
      
      // Parser les champs JSON et trier
      const parsedTasks = tasksData.map((task: any) => ({
        ...task,
        options: task.options ? (typeof task.options === 'string' ? JSON.parse(task.options) : task.options) : [],
        role_ids: task.role_ids ? (typeof task.role_ids === 'string' ? JSON.parse(task.role_ids) : task.role_ids) : []
      }))
      
      // Trier côté client par period puis order_index
      const sortedTasks = parsedTasks.sort((a: any, b: any) => {
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
    loadRoles()
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
     const filtered = tasks.filter((task) => {
      // Filtrer par période
      if (task.period !== activePeriod) return false
      
      // Filtrer par rôle si un rôle est sélectionné
      if (selectedRole !== "all") {
        // Si la tâche a des rôles définis, vérifier si le rôle sélectionné est inclus
        if (task.role_ids && Array.isArray(task.role_ids) && task.role_ids.length > 0) {
          return task.role_ids.includes(selectedRole)
        }
        // Si la tâche n'a pas de rôles définis, elle est visible par tous
        return true
      }
      
      return true
    })
    return filtered
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
            role_ids: newTask.roleIds.length > 0 ? JSON.stringify(newTask.roleIds) : null,
            user_id: userId,
            created_by: userId,
            status: 'pending'
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Erreur API:', errorData)
        throw new Error(errorData.error?.message || `Erreur ${response.status}`)
      }

      const result = await response.json()
      
      // Recharger toutes les tâches depuis le serveur
      await loadTasks()

      setNewTask({
        title: "",
        description: "",
        type: "checkbox",
        options: [],
        required: true,
        roleIds: [],
      })
      setShowForm(false)
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout:', error)
      alert(`Erreur lors de l'ajout de la tâche:\n${error.message || error}`)
    }
  }

  const openEditTask = (task: TaskItem) => {
    setEditingTask(task)
    setEditTask({
      title: task.title,
      description: task.description || "",
      type: task.type as "checkbox" | "text" | "qcm" || "checkbox",
      options: task.options || [],
      required: task.required || true,
      roleIds: task.role_ids || [],
    })
    setShowEditForm(true)
    setShowForm(false)
  }

  const updateTask = async () => {
    if (!editingTask || !editTask.title || !editTask.description) return

    try {
      const response = await fetch(`/api/db/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTask.title,
          description: editTask.description,
          type: editTask.type,
          options: editTask.type === "qcm" ? JSON.stringify(editTask.options) : null,
          required: editTask.required,
          role_ids: editTask.roleIds.length > 0 ? JSON.stringify(editTask.roleIds) : null,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `Erreur ${response.status}`)
      }

      await loadTasks()
      setShowEditForm(false)
      setEditingTask(null)
      setEditTask({
        title: "",
        description: "",
        type: "checkbox",
        options: [],
        required: true,
        roleIds: [],
      })
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error)
      alert(`Erreur lors de la modification de la tâche:\n${error.message || error}`)
    }
  }

  const deleteTask = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) return
    
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const currentPeriodTasks = getCurrentTasks().sort((a, b) => a.order_index - b.order_index)
    const oldIndex = currentPeriodTasks.findIndex((t) => t.id === active.id)
    const newIndex = currentPeriodTasks.findIndex((t) => t.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Réorganiser localement
    const reorderedTasks = arrayMove(currentPeriodTasks, oldIndex, newIndex)

    // Mettre à jour optimistiquement l'UI
    setTasks((prevTasks) => {
      const otherTasks = prevTasks.filter((t) => t.period !== activePeriod)
      return [...otherTasks, ...reorderedTasks]
    })

    // Mettre à jour les order_index dans la base de données
    try {
      for (let i = 0; i < reorderedTasks.length; i++) {
        await fetch(`/api/db/tasks/${reorderedTasks[i].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_index: i + 1 })
        })
      }
      loadTasks()
    } catch (error) {
      alert("Erreur lors du déplacement de la tâche")
      loadTasks() // Recharger en cas d'erreur
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
    return tasks.filter((task) => {
      if (task.period !== period) return false
      
      // Appliquer le même filtre de rôle
      if (selectedRole !== "all") {
        if (task.role_ids && Array.isArray(task.role_ids) && task.role_ids.length > 0) {
          return task.role_ids.includes(selectedRole)
        }
        return true
      }
      
      return true
    }).length
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
          <ListTodo className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestion des To-Do Lists</h2>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 h-auto rounded-xl shadow-lg transition-all duration-200 flex items-center gap-2 w-full sm:w-auto whitespace-nowrap"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          Nouvelle Tâche
        </Button>
      </div>

      {/* Sélecteur de salle et de rôle */}
      <Card className="border-0 shadow-xl bg-white dark:bg-gray-800">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-4">
              <Building className="h-6 w-6 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <Label className="text-lg font-medium dark:text-white">Salle :</Label>
                <Select value={selectedGym} onValueChange={setSelectedGym}>
                  <SelectTrigger className="h-12 text-lg border-2 rounded-xl mt-2">
                    <SelectValue placeholder="Choisir une salle" />
                  </SelectTrigger>
                  <SelectContent>
                    {gyms.map((gym) => (
                      <SelectItem key={gym.id} value={gym.id}>
                        {gym.name} - {gym.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-6 w-6 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-lg font-medium dark:text-white">Rôle :</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="h-12 text-lg border-2 rounded-xl mt-2">
                    <SelectValue placeholder="Filtrer par rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les rôles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: role.color }}
                          />
                          {role.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedGym && (
        <>
          {/* Navigation entre les périodes */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Button
              variant={activePeriod === "matin" ? "default" : "outline"}
              onClick={() => setActivePeriod("matin")}
              className={`text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 h-auto rounded-xl transition-all duration-200 w-full sm:w-auto whitespace-nowrap ${
                activePeriod === "matin"
                  ? "bg-red-600 text-white shadow-lg hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                  : "border-2 hover:bg-gray-50 border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Matin ({getPeriodCount("matin")} tâches)
            </Button>
            <Button
              variant={activePeriod === "aprem" ? "default" : "outline"}
              onClick={() => setActivePeriod("aprem")}
              className={`text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 h-auto rounded-xl transition-all duration-200 w-full sm:w-auto whitespace-nowrap ${
                activePeriod === "aprem"
                  ? "bg-red-600 text-white shadow-lg hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                  : "border-2 hover:bg-gray-50 border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Après-midi ({getPeriodCount("aprem")} tâches)
            </Button>
            <Button
              variant={activePeriod === "journee" ? "default" : "outline"}
              onClick={() => setActivePeriod("journee")}
              className={`text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 h-auto rounded-xl transition-all duration-200 w-full sm:w-auto whitespace-nowrap ${
                activePeriod === "journee"
                  ? "bg-red-600 text-white shadow-lg hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                  : "border-2 hover:bg-gray-50 border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Journée ({getPeriodCount("journee")} tâches)
            </Button>
          </div>

          {/* Formulaire d'édition */}
          {showEditForm && editingTask && (
            <Card className="border-0 shadow-2xl bg-white dark:bg-gray-800">
              <CardHeader className="bg-blue-600 dark:bg-blue-700 text-white rounded-t-xl">
                <CardTitle className="text-xl">
                  Modifier la tâche : {editingTask.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <Input
                  placeholder="Titre de la tâche"
                  value={editTask.title}
                  onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                  className="text-lg h-14 border-2 rounded-xl"
                />

                <Textarea
                  placeholder="Description détaillée"
                  value={editTask.description}
                  onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                  className="text-lg border-2 rounded-xl min-h-[100px]"
                />

                <div className="grid grid-cols-2 gap-6">
                  <Select
                    value={editTask.type}
                    onValueChange={(value) => setEditTask({ ...editTask, type: value as any })}
                  >
                    <SelectTrigger className="h-14 text-lg border-2 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checkbox">Case à cocher</SelectItem>
                      <SelectItem value="text">Texte libre</SelectItem>
                      <SelectItem value="qcm">Choix multiple</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
                    <input
                      type="checkbox"
                      id="edit-required"
                      checked={editTask.required}
                      onChange={(e) => setEditTask({ ...editTask, required: e.target.checked })}
                      className="w-6 h-6 text-blue-600 rounded"
                    />
                    <label htmlFor="edit-required" className="text-lg font-medium">
                      Tâche obligatoire
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-lg font-medium">Rôles autorisés (optionnel)</Label>
                  <p className="text-sm text-gray-500">Si aucun rôle n'est sélectionné, la tâche sera visible par tous les employés</p>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className={`px-3 py-2 rounded-lg cursor-pointer border-2 transition-all ${
                          editTask.roleIds.includes(role.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                        onClick={() => {
                          const isSelected = editTask.roleIds.includes(role.id)
                          setEditTask({
                            ...editTask,
                            roleIds: isSelected
                              ? editTask.roleIds.filter((id) => id !== role.id)
                              : [...editTask.roleIds, role.id]
                          })
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="font-medium">{role.name}</span>
                          {editTask.roleIds.includes(role.id) && (
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {editTask.type === "qcm" && (
                  <Textarea
                    placeholder="Options (une par ligne)&#10;Option 1&#10;Option 2&#10;Option 3"
                    value={editTask.options.join("\n")}
                    onChange={(e) =>
                      setEditTask({
                        ...editTask,
                        options: e.target.value.split("\n").filter((opt) => opt.trim()),
                      })
                    }
                    className="text-lg border-2 rounded-xl"
                  />
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <Button
                    onClick={updateTask}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-lg px-4 sm:px-8 py-3 rounded-xl shadow-lg flex items-center gap-2 w-full sm:w-auto"
                  >
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    Enregistrer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditForm(false)
                      setEditingTask(null)
                    }}
                    className="text-sm sm:text-lg px-4 sm:px-8 py-3 border-2 rounded-xl border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-2 w-full sm:w-auto"
                  >
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Formulaire d'ajout */}
          {showForm && (
            <Card className="border-0 shadow-2xl bg-white dark:bg-gray-800">
              <CardHeader className="bg-red-600 dark:bg-red-700 text-white rounded-t-xl">
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
                      <SelectItem value="checkbox">Case à cocher</SelectItem>
                      <SelectItem value="text">Texte libre</SelectItem>
                      <SelectItem value="qcm">Choix multiple</SelectItem>
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

                <div className="space-y-2">
                  <Label className="text-lg font-medium">Rôles autorisés (optionnel)</Label>
                  <p className="text-sm text-gray-500">Si aucun rôle n'est sélectionné, la tâche sera visible par tous les employés</p>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className={`px-3 py-2 rounded-lg cursor-pointer border-2 transition-all ${
                          newTask.roleIds.includes(role.id)
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                        onClick={() => {
                          const isSelected = newTask.roleIds.includes(role.id)
                          setNewTask({
                            ...newTask,
                            roleIds: isSelected
                              ? newTask.roleIds.filter((id) => id !== role.id)
                              : [...newTask.roleIds, role.id]
                          })
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="font-medium">{role.name}</span>
                          {newTask.roleIds.includes(role.id) && (
                            <CheckCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </div>
                    ))}
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

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <Button
                    onClick={addTask}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm sm:text-lg px-4 sm:px-8 py-3 rounded-xl shadow-lg flex items-center gap-2 w-full sm:w-auto"
                  >
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    Ajouter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="text-sm sm:text-lg px-4 sm:px-8 py-3 border-2 rounded-xl border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-2 w-full sm:w-auto"
                  >
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liste des tâches */}
          <div className="space-y-4">
            <h3
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              {activePeriod === "matin"
                ? "Tâches du Matin"
                : activePeriod === "aprem"
                  ? "Tâches de l'Après-midi"
                  : "Tâches de la Journée"}{" "}
              - {selectedGymName}
            </h3>

            {currentTasks.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex justify-center mb-3">
                    <ListTodo className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-lg mb-2 dark:text-gray-300">Aucune tâche dans cette to-do list</p>
                  <p>Cliquez sur "Nouvelle Tâche" pour en ajouter une</p>
                </CardContent>
              </Card>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {currentTasks.map((task, index) => (
                      <SortableTaskItem
                        key={task.id}
                        task={task}
                        index={index}
                        roles={roles}
                        onDelete={deleteTask}
                        onEdit={openEditTask}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}
    </div>
  )
}
