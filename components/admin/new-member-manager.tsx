"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { Save, UserPlus, Loader2, Plus, Trash2, Check, X, GripVertical } from "lucide-react"
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
} from '@dnd-kit/sortable'
import { SortableInstructionItem } from './sortable-instruction-item'

interface InstructionItem {
  id: number
  title: string
  description: string | null
  order_index: number
  is_active: boolean
}

export function NewMemberManager() {
  const [instructions, setInstructions] = useState<InstructionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)

  const loadInstructions = async () => {
    try {
      const response = await fetch("/api/db/new_member_instruction_items?orderBy=order_index&orderDir=asc")
      if (response.ok) {
        const result = await response.json()
        // L'API retourne { data: [...], error: null }
        setInstructions(result.data || [])
      }
    } catch (error) {
      console.error("Erreur lors du chargement des instructions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInstructions()
  }, [])

  useAutoRefresh(loadInstructions, 30000)

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    
    setIsSaving(true)
    try {
      const maxOrder = instructions.length > 0 
        ? Math.max(...instructions.map(i => i.order_index))
        : 0

      const response = await fetch("/api/db/new_member_instruction_items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            title: newTitle,
            description: newDescription || null,
            order_index: maxOrder + 1,
            is_active: true
          }
        })
      })

      if (response.ok) {
        setNewTitle("")
        setNewDescription("")
        setShowAddForm(false)
        await loadInstructions()
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (item: InstructionItem) => {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditDescription(item.description || "")
  }

  const handleSaveEdit = async (id: number) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/db/new_member_instruction_items?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null
        })
      })

      if (response.ok) {
        setEditingId(null)
        await loadInstructions()
      }
    } catch (error) {
      console.error("Erreur lors de la modification:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette instruction ?")) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/db/new_member_instruction_items?id=${id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        await loadInstructions()
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (item: InstructionItem) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/db/new_member_instruction_items?id=${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !item.is_active })
      })

      if (response.ok) {
        await loadInstructions()
      }
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = instructions.findIndex((item) => item.id === active.id)
    const newIndex = instructions.findIndex((item) => item.id === over.id)

    const newInstructions = arrayMove(instructions, oldIndex, newIndex)
    setInstructions(newInstructions)

    // Sauvegarder les nouveaux order_index
    setIsSaving(true)
    try {
      const updates = newInstructions.map((item, index) =>
        fetch(`/api/db/new_member_instruction_items?id=${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: index + 1 })
        })
      )
      await Promise.all(updates)
      await loadInstructions()
    } catch (error) {
      console.error("Erreur lors de la réorganisation:", error)
      await loadInstructions() // Recharger en cas d'erreur
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="border-b border-gray-200 bg-gray-50 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-semibold text-gray-900">
            <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
            Instructions Nouveau Adhérent
          </CardTitle>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            size="sm"
          >
            <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            Ajouter une étape
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
        {/* Formulaire d'ajout */}
        {showAddForm && (
          <Card className="border-2 border-red-200 bg-white">
            <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="space-y-1 md:space-y-2">
                <Label htmlFor="newTitle" className="text-xs md:text-sm font-medium text-gray-700">
                  Titre de l'étape *
                </Label>
                <Input
                  id="newTitle"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Demander une pièce d'identité"
                  className="border-gray-300 focus:border-red-600 text-sm md:text-base"
                />
              </div>
              <div className="space-y-1 md:space-y-2">
                <Label htmlFor="newDescription" className="text-xs md:text-sm font-medium text-gray-700">
                  Description (optionnelle)
                </Label>
                <Textarea
                  id="newDescription"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Détails supplémentaires..."
                  className="border-gray-300 focus:border-red-600 min-h-[50px] md:min-h-[60px] text-sm md:text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleAdd}
                  disabled={isSaving || !newTitle.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white flex-1 text-sm md:text-base"
                  size="sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                      Ajout...
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      Ajouter
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowAddForm(false)
                    setNewTitle("")
                    setNewDescription("")
                  }}
                  variant="outline"
                  className="border-gray-300 text-sm md:text-base bg-white hover:bg-gray-50"
                  size="sm"
                >
                  <X className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liste des instructions */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2">
            {!Array.isArray(instructions) || instructions.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-sm md:text-base text-gray-500">
                Aucune instruction configurée. Cliquez sur "Ajouter une étape" pour commencer.
              </div>
            ) : (
              <SortableContext
                items={instructions.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {instructions.map((item, index) => (
                  <SortableInstructionItem
                    key={item.id}
                    item={item}
                    index={index}
                    editingId={editingId}
                    editTitle={editTitle}
                    editDescription={editDescription}
                    isSaving={isSaving}
                    onEdit={handleEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    setEditTitle={setEditTitle}
                    setEditDescription={setEditDescription}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </DndContext>
      </CardContent>
    </Card>
  )
}
