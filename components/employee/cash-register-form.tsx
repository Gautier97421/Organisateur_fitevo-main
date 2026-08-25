"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { FileText, XCircle, CheckCircle, Minus, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  mode?: "start" | "end"
}

export function CashRegisterForm({ isOpen, onClose, onSubmit, period, mode = "end" }: CashRegisterFormProps) {
  const [formData, setFormData] = useState<CashRegisterData>({
    cash_amount: 0,
    total_register: 0,
    coins_detail: "",
    notes: "",
  })

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

  const handleSubmit = () => {
    const computedTotal = calculateTotal()

    const finalData = {
      ...formData,
      cash_amount: computedTotal,
      total_register: computedTotal,
      coins_detail: Object.entries(coinCounts)
        .filter(([_, count]) => count > 0)
        .map(([value, count]) => `${coinLabels[value as keyof typeof coinLabels]}: ${count}`)
        .join(", "),
      // Conserve aussi les coinCounts bruts pour permettre la modification ultérieure
      _coinCounts: { ...coinCounts },
      notes: isStartMode ? "" : formData.notes,
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
  const isStartMode = mode === "start"

  const dialogTitle = isStartMode
    ? "Comptage de caisse d'ouverture"
    : "Fiche de Caisse - " + getPeriodText()

  const dialogDescription = isStartMode
    ? "Ouverture du jour : la caisse n'a pas encore été comptée aujourd'hui, comptez-la avant de commencer."
    : "Comptage de caisse de fermeture : remplissez le détail de la caisse pour clôturer votre période."

  const submitLabel = isStartMode ? "Valider l'ouverture" : "Valider et Envoyer"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg md:text-2xl flex items-center gap-2 text-gray-900">
            <span className="text-2xl md:text-3xl flex-shrink-0">💰</span>
            <span className="break-words">{dialogTitle}</span>
          </DialogTitle>
          <DialogDescription className="text-sm md:text-lg text-gray-600">
            {dialogDescription}
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

          {/* Notes */}
          {!isStartMode && (
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
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button variant="outline" onClick={onClose} className="text-base md:text-lg px-4 md:px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center justify-center gap-2 w-full sm:w-auto">
            <XCircle className="h-5 w-5" /> Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={total <= 0}
            className="bg-green-600 hover:bg-green-700 text-base md:text-lg px-4 md:px-6 flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <CheckCircle className="h-5 w-5" /> {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
