"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Trash2, Check, X, Edit, GripVertical, Eye, EyeOff, Users, Shield } from "lucide-react"
import * as LucideIcons from "lucide-react"
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
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface CustomPageItem {
  id: number
  title: string
  description: string | null
  orderIndex: number
  isActive: boolean
}

interface Role {
  id: string
  name: string
  color: string
}

interface CustomPageContentProps {
  pageId: string
  pageTitle: string
  pageIcon: string
}

function SortableItem({ 
  item, 
  index,
  editingId,
  editTitle,
  editDescription,
  isSaving,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleActive,
  setEditTitle,
  setEditDescription
}: {
  item: CustomPageItem
  index: number
  editingId: number | null
  editTitle: string
  editDescription: string
  isSaving: boolean
  onEdit: (item: CustomPageItem) => void
  onSaveEdit: (id: number) => void
  onCancelEdit: () => void
  onDelete: (id: number) => void
  onToggleActive: (item: CustomPageItem) => void
  setEditTitle: (value: string) => void
  setEditDescription: (value: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isEditing = editingId === item.id

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`border ${item.isActive ? 'border-gray-200' : 'border-gray-300 bg-gray-50'}`}
    >
      <CardContent className="p-3 md:p-4">
        {isEditing ? (
          <div className="space-y-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Titre de l'étape"
              className="border-gray-300 focus:border-red-600 text-sm md:text-base"
            />
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optionnelle)"
              className="border-gray-300 focus:border-red-600 min-h-[50px] text-sm md:text-base"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => onSaveEdit(item.id)}
                disabled={isSaving}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                Sauvegarder
              </Button>
              <Button
                onClick={onCancelEdit}
                size="sm"
                variant="outline"
                className="border-gray-300"
              >
                <X className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 md:gap-3">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mt-1"
            >
              <GripVertical className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <span className={`text-xs md:text-sm font-semibold ${item.isActive ? 'text-red-600' : 'text-gray-400'} flex-shrink-0`}>
                  {index + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm md:text-base ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {item.title}
                  </h4>
                  {item.description && (
                    <p className="text-xs md:text-sm text-gray-600 mt-1 break-words">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                onClick={() => onEdit(item)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 md:h-8 md:w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Edit className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
              <Button
                onClick={() => onToggleActive(item)}
                variant="ghost"
                size="sm"
                className={`h-7 w-7 md:h-8 md:w-8 p-0 ${
                  item.isActive 
                    ? 'text-orange-600 hover:bg-orange-50' 
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={item.isActive ? "Désactiver l'étape" : "Activer l'étape"}
              >
                {item.isActive ? (
                  <EyeOff className="w-3 h-3 md:w-4 md:h-4" />
                ) : (
                  <Eye className="w-3 h-3 md:w-4 md:h-4" />
                )}
              </Button>
              <Button
                onClick={() => onDelete(item.id)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 md:h-8 md:w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CustomPageContent({ pageId, pageTitle, pageIcon }: CustomPageContentProps) {
  const [items, setItems] = useState<CustomPageItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [pageRoleIds, setPageRoleIds] = useState<string[]>([])
  const [showRolesDialog, setShowRolesDialog] = useState(false)

  const IconComponent = (LucideIcons as any)[pageIcon]

  const loadItems = async () => {
    try {
      const response = await fetch(`/api/custom-page-items?pageId=${pageId}`)
      if (response.ok) {
        const result = await response.json()
        setItems(result.data || [])
      }
    } catch (error) {
      console.error("Error loading items:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await fetch("/api/db/roles?orderBy=name")
      if (response.ok) {
        const result = await response.json()
        setRoles(Array.isArray(result.data) ? result.data : [])
      }
    } catch (error) {
      console.error("Error loading roles:", error)
    }
  }

  const loadPageRoles = async () => {
    try {
      const response = await fetch(`/api/custom-pages?id=${pageId}`)
      if (response.ok) {
        const result = await response.json()
        const page = result.data
        if (page && page.roleIds) {
          setPageRoleIds(Array.isArray(page.roleIds) ? page.roleIds : [])
        } else {
          setPageRoleIds([])
        }
      }
    } catch (error) {
      console.error("Error loading page roles:", error)
    }
  }

  useEffect(() => {
    loadItems()
    loadRoles()
    loadPageRoles()
  }, [pageId])

  useAutoRefresh(loadItems, 30000)

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    
    setIsSaving(true)
    try {
      const response = await fetch("/api/custom-page-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          title: newTitle,
          description: newDescription || null
        })
      })

      if (response.ok) {
        setNewTitle("")
        setNewDescription("")
        setShowAddForm(false)
        await loadItems()
      }
    } catch (error) {
      console.error("Error adding item:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (item: CustomPageItem) => {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditDescription(item.description || "")
  }

  const handleSaveEdit = async (id: number) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/custom-page-items?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null
        })
      })

      if (response.ok) {
        setEditingId(null)
        await loadItems()
      }
    } catch (error) {
      console.error("Error updating item:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/custom-page-items?id=${deleteConfirmId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        await loadItems()
      }
    } catch (error) {
      console.error("Error deleting item:", error)
    } finally {
      setIsSaving(false)
      setDeleteConfirmId(null)
    }
  }

  const handleToggleActive = async (item: CustomPageItem) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/custom-page-items?id=${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive })
      })

      if (response.ok) {
        await loadItems()
      }
    } catch (error) {
      console.error("Error toggling item:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleRoleInPage = (roleId: string) => {
    setPageRoleIds(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId)
      } else {
        return [...prev, roleId]
      }
    })
  }

  const handleUpdatePageRoles = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/custom-pages?id=${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: pageRoleIds })
      })

      if (response.ok) {
        setShowRolesDialog(false)
        await loadPageRoles()
      }
    } catch (error) {
      console.error("Error updating page roles:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const getRoleColor = (color: string) => {
    const colorMap: { [key: string]: string } = {
      rouge: "bg-red-100 text-red-800 border-red-300",
      bleu: "bg-blue-100 text-blue-800 border-blue-300",
      vert: "bg-green-100 text-green-800 border-green-300",
      jaune: "bg-yellow-100 text-yellow-800 border-yellow-300",
      orange: "bg-orange-100 text-orange-800 border-orange-300",
      mauve: "bg-purple-100 text-purple-800 border-purple-300",
    }
    return colorMap[color.toLowerCase()] || "bg-gray-100 text-gray-800 border-gray-300"
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

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)

    const newItems = arrayMove(items, oldIndex, newIndex)
    setItems(newItems)

    setIsSaving(true)
    try {
      const updates = newItems.map((item, index) =>
        fetch(`/api/custom-page-items?id=${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIndex: index + 1 })
        })
      )
      await Promise.all(updates)
      await loadItems()
    } catch (error) {
      await loadItems()
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="border-b border-gray-200 bg-gray-50 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-semibold text-gray-900">
            {IconComponent && <IconComponent className="w-5 h-5 md:w-6 md:h-6 text-red-600" />}
            {pageTitle}
          </CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setShowRolesDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-initial"
              size="sm"
            >
              <Users className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              Assignation aux rôles
            </Button>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-initial"
              size="sm"
            >
              <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              Ajouter une étape
            </Button>
          </div>
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
                  placeholder="Ex: Vérifier les documents"
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

        {/* Liste des items */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2">
            {!Array.isArray(items) || items.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-sm md:text-base text-gray-500">
                Aucune étape configurée. Cliquez sur "Ajouter une étape" pour commencer.
              </div>
            ) : (
              <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item, index) => (
                  <SortableItem
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
                    onDelete={(id) => setDeleteConfirmId(id)}
                    onToggleActive={handleToggleActive}
                    setEditTitle={setEditTitle}
                    setEditDescription={setEditDescription}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </DndContext>

        {/* Dialog de confirmation de suppression */}
        <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer cette étape ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>

      {/* Dialog d'assignation des rôles */}
      <Dialog open={showRolesDialog} onOpenChange={setShowRolesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Assignation aux rôles
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Sélectionnez les rôles qui auront accès à cette page personnalisée. Si aucun rôle n'est sélectionné, tous les employés auront accès.
            </p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => toggleRoleInPage(role.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    pageRoleIds.includes(role.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {pageRoleIds.includes(role.id) ? (
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium px-2 py-1 rounded-md border ${
                      getRoleColor(role.color)
                    }`}>
                      {role.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowRolesDialog(false)}
              variant="outline"
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdatePageRoles}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
