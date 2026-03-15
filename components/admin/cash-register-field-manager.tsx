"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Edit2, Trash2, GripVertical } from "lucide-react"

interface CashRegisterField {
  id: string
  label: string
  fieldType: string
  isRequired: boolean
  orderIndex: number
  period?: string
  gymId?: string
  isActive: boolean
}

interface CashRegisterFieldManagerProps {
  onFieldsUpdated?: () => void
}

export function CashRegisterFieldManager({ onFieldsUpdated }: CashRegisterFieldManagerProps) {
  const [fields, setFields] = useState<CashRegisterField[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [selectedField, setSelectedField] = useState<CashRegisterField | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const [formData, setFormData] = useState({
    label: "",
    fieldType: "number",
    isRequired: false,
    period: "",
  })

  // Charger les champs
  useEffect(() => {
    loadFields()
  }, [])

  const loadFields = async () => {
    try {
      const response = await fetch("/api/db/cash-register-fields")
      if (response.ok) {
        const data = await response.json()
        setFields(Array.isArray(data.data) ? data.data : [])
      }
    } catch (error) {
      console.error("Erreur lors du chargement des champs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (field?: CashRegisterField) => {
    if (field) {
      setSelectedField(field)
      setFormData({
        label: field.label,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        period: field.period || "",
      })
      setIsEditing(true)
    } else {
      setSelectedField(null)
      setFormData({
        label: "",
        fieldType: "number",
        isRequired: false,
        period: "",
      })
      setIsEditing(false)
    }
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.label.trim()) {
      alert("Le label est obligatoire")
      return
    }

    try {
      if (isEditing && selectedField) {
        await fetch("/api/db/cash-register-fields", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedField.id,
            ...formData
          })
        })
      } else {
        const userEmail = localStorage.getItem("userEmail") || "admin"
        await fetch("/api/db/cash-register-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            createdBy: userEmail
          })
        })
      }

      setShowDialog(false)
      loadFields()
      onFieldsUpdated?.()
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error)
      alert("Erreur lors de la sauvegarde du champ")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce champ ?")) return

    try {
      await fetch(`/api/db/cash-register-fields?id=${id}`, {
        method: "DELETE"
      })
      loadFields()
      onFieldsUpdated?.()
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
      alert("Erreur lors de la suppression du champ")
    }
  }

  const getFieldTypeLabel = (type: string) => {
    switch (type) {
      case "number":
        return "Nombre"
      case "text":
        return "Texte"
      case "checkbox":
        return "Case à cocher"
      default:
        return type
    }
  }

  const getPeriodLabel = (period?: string) => {
    if (!period) return "Toutes"
    switch (period) {
      case "matin":
        return "Matin"
      case "aprem":
        return "Après-midi"
      case "journee":
        return "Journée"
      default:
        return period
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center">Chargement des champs...</div>
  }

  return (
    <div className="space-y-4">
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader className="pb-4">
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Champs de Caisse Personnalisés</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Gérez les champs supplémentaires pour la fiche de caisse</p>
            </div>
            <Button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleOpenDialog()
              }}
              className="bg-blue-600 hover:bg-blue-700 flex-shrink-0"
              type="button"
            >
              <Plus className="h-4 w-4 mr-2" /> Ajouter un champ
            </Button>
          </div>
        </CardHeader>
      </Card>

      {fields.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <p>Aucun champ personnalisé défini. Cliquez sur "Ajouter un champ" pour commencer.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {fields.sort((a, b) => a.orderIndex - b.orderIndex).map((field) => (
            <Card key={field.id} className="border-2">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <GripVertical className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{field.label}</h3>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{getFieldTypeLabel(field.fieldType)}</Badge>
                      <Badge variant="outline">Période: {getPeriodLabel(field.period)}</Badge>
                      {field.isRequired && (
                        <Badge className="bg-red-100 text-red-800">Obligatoire</Badge>
                      )}
                      {!field.isActive && (
                        <Badge className="bg-gray-100 text-gray-800">Inactif</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleOpenDialog(field)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(field.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog d'ajout/modification */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md z-50">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier le champ" : "Ajouter un nouveau champ"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Modifiez les propriétés du champ de caisse" : "Créez un nouveau champ personnalisé pour la fiche de caisse"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Label du champ *</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="ex: Nombre d'inscriptions"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Type de champ</Label>
              <Select value={formData.fieldType} onValueChange={(value) => setFormData({ ...formData, fieldType: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Nombre</SelectItem>
                  <SelectItem value="text">Texte</SelectItem>
                  <SelectItem value="checkbox">Case à cocher</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Période</Label>
              <Select value={formData.period} onValueChange={(value) => setFormData({ ...formData, period: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toutes les périodes</SelectItem>
                  <SelectItem value="matin">Matin</SelectItem>
                  <SelectItem value="aprem">Après-midi</SelectItem>
                  <SelectItem value="journee">Journée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="required"
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData({ ...formData, isRequired: !!checked })}
              />
              <Label htmlFor="required" className="text-sm font-medium cursor-pointer">
                Champ obligatoire
              </Label>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {isEditing ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
