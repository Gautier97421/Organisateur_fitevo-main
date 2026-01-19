"use client"

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Check, GripVertical, X } from "lucide-react"

interface InstructionItem {
  id: number
  title: string
  description: string | null
  order_index: number
  is_active: boolean
}

interface SortableInstructionItemProps {
  item: InstructionItem
  index: number
  editingId: number | null
  editTitle: string
  editDescription: string
  isSaving: boolean
  onEdit: (item: InstructionItem) => void
  onSaveEdit: (id: number) => void
  onCancelEdit: () => void
  onDelete: (id: number) => void
  onToggleActive: (item: InstructionItem) => void
  setEditTitle: (value: string) => void
  setEditDescription: (value: string) => void
}

export function SortableInstructionItem({
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
  setEditDescription,
}: SortableInstructionItemProps) {
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`border-2 shadow-sm ${
        item.is_active ? "border-red-200 bg-white" : "border-gray-200 bg-gray-50 opacity-70"
      }`}
    >
      <CardContent className="p-3 md:p-4">
        {editingId === item.id ? (
          // Mode édition
          <div className="space-y-2 md:space-y-3">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="border-gray-300 focus:border-red-600 font-medium text-sm md:text-base"
            />
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description..."
              className="border-gray-300 focus:border-red-600 min-h-[50px] md:min-h-[60px] text-sm md:text-base"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => onSaveEdit(item.id)}
                disabled={isSaving}
                className="bg-red-600 hover:bg-red-700 text-white flex-1 text-sm md:text-base"
                size="sm"
              >
                <Check className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Enregistrer
              </Button>
              <Button
                onClick={onCancelEdit}
                variant="outline"
                className="border-gray-300 text-sm md:text-base bg-white hover:bg-gray-50"
                size="sm"
              >
                <X className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          // Mode affichage
          <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none"
              >
                <GripVertical className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-red-600" />
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0 shadow-sm">
                {index + 1}
              </div>
            </div>
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <h3 className="font-medium text-sm md:text-base text-gray-900">{item.title}</h3>
              {item.description && (
                <p className="text-xs md:text-sm text-gray-600 mt-1">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end sm:justify-start">
              <Button
                onClick={() => onToggleActive(item)}
                variant="ghost"
                size="sm"
                className={`${item.is_active ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-500"} px-2`}
                title={item.is_active ? "Désactiver" : "Activer"}
              >
                <Check className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
              <Button
                onClick={() => onEdit(item)}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 text-xs md:text-sm px-2"
              >
                Modifier
              </Button>
              <Button
                onClick={() => onDelete(item.id)}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 px-2"
                title="Supprimer"
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
