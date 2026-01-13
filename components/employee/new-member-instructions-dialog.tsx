"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { UserPlus, X } from "lucide-react"

interface InstructionItem {
  id: number
  title: string
  description: string | null
  order_index: number
  is_active: boolean
}

interface NewMemberInstructionsDialogProps {
  instructions: InstructionItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewMemberInstructionsDialog({
  instructions,
  open,
  onOpenChange,
}: NewMemberInstructionsDialogProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())

  // Réinitialiser les cases cochées quand on ouvre/ferme le dialog
  useEffect(() => {
    if (!open) {
      setCheckedItems(new Set())
    }
  }, [open])

  const handleToggle = (id: number) => {
    const newChecked = new Set(checkedItems)
    if (newChecked.has(id)) {
      newChecked.delete(id)
    } else {
      newChecked.add(id)
    }
    setCheckedItems(newChecked)
  }

  const activeInstructions = Array.isArray(instructions) ? instructions.filter(item => item.is_active) : []
  const completedCount = checkedItems.size
  const totalCount = activeInstructions.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg md:text-xl font-semibold text-gray-900">
            <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            Instructions - Nouveau Adhérent
          </DialogTitle>
          {totalCount > 0 && (
            <p className="text-xs md:text-sm text-gray-500 mt-2">
              Progression : {completedCount} / {totalCount} étapes complétées
            </p>
          )}
        </DialogHeader>
        <div className="space-y-2 md:space-y-3 py-3 md:py-4">
          {activeInstructions.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-gray-500 text-sm md:text-base">
              Aucune instruction n'a été configurée pour le moment.
              <br />
              Contactez votre administrateur.
            </div>
          ) : (
            activeInstructions.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                  checkedItems.has(item.id)
                    ? "bg-green-50 border-green-200"
                    : "bg-white border-gray-200 hover:border-blue-300"
                }`}
              >
                <Checkbox
                  id={`instruction-${item.id}`}
                  checked={checkedItems.has(item.id)}
                  onCheckedChange={() => handleToggle(item.id)}
                  className="mt-1 flex-shrink-0"
                />
                <label
                  htmlFor={`instruction-${item.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {index + 1}
                    </div>
                    <h3
                      className={`font-medium text-sm md:text-base ${
                        checkedItems.has(item.id)
                          ? "text-gray-500 line-through"
                          : "text-gray-900"
                      }`}
                    >
                      {item.title}
                    </h3>
                  </div>
                  {item.description && (
                    <p
                      className={`text-xs md:text-sm ml-6 md:ml-8 ${
                        checkedItems.has(item.id) ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {item.description}
                    </p>
                  )}
                </label>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-gray-200 pt-3 md:pt-4 gap-2">
          {totalCount > 0 && (
            <div className="text-xs md:text-sm text-gray-600">
              {completedCount === totalCount ? (
                <span className="text-green-600 font-medium">✓ Toutes les étapes complétées !</span>
              ) : (
                <span>Encore {totalCount - completedCount} étape(s) à faire</span>
              )}
            </div>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            size="sm"
            className="border-gray-300 ml-auto text-sm md:text-base"
          >
            <X className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
