"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, FileText, XCircle, CheckCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CashRegisterField {
  id: string
  label: string
  fieldType: string
  isRequired: boolean
  orderIndex: number
}

interface CashRegisterData {
  cash_amount: number
  total_register: number
  coins_detail: string
  notes?: string
  [key: string]: any
}

interface CashRegisterFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CashRegisterData) => void
  period: "matin" | "aprem" | "journee"
  gymId?: string
}

export function CashRegisterForm({ isOpen, onClose, onSubmit, period, gymId }: CashRegisterFormProps) {
  const [formData, setFormData] = useState<CashRegisterData>({
    cash_amount: 0,
    total_register: 0,
    coins_detail: "",
    notes: "",
  })

  const [customFields, setCustomFields] = useState<CashRegisterField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({})
  const [isLoadingFields, setIsLoadingFields] = useState(true)

  const [coinCounts, setCoinCounts] = useState({
    "0.01": 0,
    "0.02": 0,
    "0.05": 0,
    "0.10": 0,
    "0.20": 0,
    "0.50": 0,
    "1.00": 0,
    "2.00": 0,
    "5.00": 0,
    "10.00": 0,
    "20.00": 0,
    "50.00": 0,
    "100.00": 0,
    "200.00": 0,
    "500.00": 0,
  })

  // Charger les champs personnalisés
  useEffect(() => {
    const loadCustomFields = async () => {
      try {
        let url = "/api/db/cash-register-fields?period=" + period
        if (gymId) {
          url += "&gym_id=" + gymId
        }
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          const fields = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : [])
          setCustomFields(fields)
          
          // Initialiser les valeurs des champs personnalisés
          const initialValues: Record<string, any> = {}
          fields.forEach((field: CashRegisterField) => {
            initialValues[field.id] = field.fieldType === "checkbox" ? false : ""
          })
          setCustomFieldValues(initialValues)
        }
      } catch (error) {
        console.error("Erreur lors du chargement des champs personnalisés:", error)
      } finally {
        setIsLoadingFields(false)
      }
    }
    
    if (isOpen) {
      loadCustomFields()
    }
  }, [isOpen, period, gymId])

  const coinLabels = {
    "0.01": "1 centime",
    "0.02": "2 centimes",
    "0.05": "5 centimes",
    "0.10": "10 centimes",
    "0.20": "20 centimes",
    "0.50": "50 centimes",
    "1.00": "1 euro",
    "2.00": "2 euros",
    "5.00": "5 euros",
    "10.00": "10 euros",
    "20.00": "20 euros",
    "50.00": "50 euros",
    "100.00": "100 euros",
    "200.00": "200 euros",
    "500.00": "500 euros",
  }

  const calculateTotal = () => {
    return Object.entries(coinCounts).reduce((total, [value, count]) => {
      return total + Number.parseFloat(value) * count
    }, 0)
  }

  const updateCoinCount = (value: string, count: number) => {
    setCoinCounts((prev) => ({
      ...prev,
      [value]: Math.max(0, count),
    }))
  }

  const generateCoinsDetail = () => {
    const details = Object.entries(coinCounts)
      .filter(([_, count]) => count > 0)
      .map(([value, count]) => `${coinLabels[value as keyof typeof coinLabels]}: ${count}`)
      .join(", ")

    setFormData((prev) => ({
      ...prev,
      coins_detail: details,
      cash_amount: calculateTotal(),
    }))
  }

  const handleSubmit = () => {
    generateCoinsDetail()

    // Sécuriser les champs numériques personnalisés: jamais de valeur négative.
    const sanitizedCustomValues: Record<string, any> = { ...customFieldValues }
    customFields.forEach((field) => {
      if (field.fieldType === "number") {
        const raw = sanitizedCustomValues[field.id]
        if (raw === "" || raw === null || raw === undefined) {
          sanitizedCustomValues[field.id] = ""
        } else {
          const parsed = Number(raw)
          sanitizedCustomValues[field.id] = Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
        }
      }
    })

    const finalData = {
      ...formData,
      cash_amount: calculateTotal(),
      coins_detail: Object.entries(coinCounts)
        .filter(([_, count]) => count > 0)
        .map(([value, count]) => `${coinLabels[value as keyof typeof coinLabels]}: ${count}`)
        .join(", "),
      ...sanitizedCustomValues
    }
    onSubmit(finalData)
  }

  const getPeriodText = () => {
    switch (period) {
      case "matin":
        return "Matin"
      case "aprem":
        return "Après-midi"
      case "journee":
        return "Journée entière"
    }
  }

  const total = calculateTotal()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center space-x-2 text-gray-900">
            <span className="text-3xl">💰</span>
            <span>Fiche de Caisse - {getPeriodText()}</span>
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-600">
            Veuillez remplir le détail de la caisse avant d'envoyer votre to-do list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Détail des pièces et billets */}
          <Card className="bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900">
                💰 Détail des pièces et billets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                {Object.entries(coinLabels).map(([value, label]) => (
                  <div key={value} className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">{label}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={coinCounts[value as keyof typeof coinCounts]}
                      onChange={(e) => updateCoinCount(value, Number.parseInt(e.target.value) || 0)}
                      className="text-center border-2 rounded-xl bg-white text-gray-900"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-green-100 rounded-xl border border-green-200">
                <div className="text-center">
                  <span className="text-lg font-bold text-green-800">
                    Total calculé : {total.toFixed(2)} €
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Montant total de la caisse */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-lg font-medium text-gray-900">💵 Total de la caisse</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.total_register}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, total_register: Number.parseFloat(e.target.value) || 0 }))
                }
                placeholder="0.00"
                className="text-lg border-2 rounded-xl bg-white text-gray-900"
              />
              <p className="text-sm text-gray-600">
                Montant total présent dans la caisse (incluant les ventes)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-lg font-medium text-gray-900">💸 Montant liquide compté</Label>
              <Input
                type="number"
                step="0.01"
                value={total.toFixed(2)}
                readOnly
                className="text-lg border-2 rounded-xl bg-gray-100 text-gray-900"
              />
              <p className="text-sm text-gray-600">
                Calculé automatiquement à partir du détail ci-dessus
              </p>
            </div>
          </div>

          {/* Différence */}
          {formData.total_register > 0 && (
            <Card
              className={`${Math.abs(total - formData.total_register) > 0.01 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}
            >
              <CardContent className="p-4">
                <div className="text-center">
                  <span
                    className={`text-lg font-bold ${Math.abs(total - formData.total_register) > 0.01 ? "text-red-800" : "text-green-800"}`}
                  >
                    Différence : {(total - formData.total_register).toFixed(2)} €
                  </span>
                  {Math.abs(total - formData.total_register) > 0.01 && (
                    <p className="text-sm text-red-600 mt-1">
                      <AlertTriangle className="h-4 w-4 inline-block mr-1" />
                      Il y a une différence entre le montant compté et le total de la caisse
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Champs personnalisés de caisse */}
          {!isLoadingFields && customFields.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">📋 Informations supplémentaires</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label className="text-sm font-medium text-gray-900">
                      {field.label}
                      {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.fieldType === "checkbox" ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={customFieldValues[field.id] || false}
                          onCheckedChange={(checked) =>
                            setCustomFieldValues({
                              ...customFieldValues,
                              [field.id]: checked
                            })
                          }
                        />
                        <span className="text-sm text-gray-600">{field.label}</span>
                      </div>
                    ) : (
                      <Input
                        type={field.fieldType === "number" ? "number" : "text"}
                        value={customFieldValues[field.id] || ""}
                        min={field.fieldType === "number" ? 0 : undefined}
                        onChange={(e) => {
                          if (field.fieldType === "number") {
                            if (e.target.value === "") {
                              setCustomFieldValues({
                                ...customFieldValues,
                                [field.id]: ""
                              })
                              return
                            }

                            const parsed = Number(e.target.value)
                            setCustomFieldValues({
                              ...customFieldValues,
                              [field.id]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
                            })
                            return
                          }

                          setCustomFieldValues({
                            ...customFieldValues,
                            [field.id]: e.target.value
                          })
                        }}
                        className="text-lg border-2 rounded-xl bg-white text-gray-900"
                        placeholder={field.label}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5" /> Notes (optionnel)
            </Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Remarques, incidents, observations..."
              className="text-lg border-2 rounded-xl bg-white text-gray-900"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex space-x-3">
          <Button variant="outline" onClick={onClose} className="text-lg px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-2">
            <XCircle className="h-5 w-5" /> Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={formData.total_register <= 0}
            className="bg-green-600 hover:bg-green-700 text-lg px-6 flex items-center gap-2"
          >
            <CheckCircle className="h-5 w-5" /> Valider et Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
