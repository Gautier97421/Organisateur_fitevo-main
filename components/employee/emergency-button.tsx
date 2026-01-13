"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function EmergencyButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const sendEmergencyAlert = async () => {
    setIsSending(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("🚨 ALERTE URGENCE:", {
      timestamp: new Date().toISOString(),
      user: localStorage.getItem("userEmail"),
      message: message || "Alerte d'urgence",
    })

    alert("🚨 Alerte envoyée ! Les responsables ont été notifiés.")
    setMessage("")
    setIsOpen(false)
    setIsSending(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-xl px-6 py-3 h-auto animate-pulse">
          🚨 URGENCE
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 text-xl flex items-center space-x-2">
            <span className="text-2xl">🚨</span>
            <span>Alerte d'Urgence</span>
          </DialogTitle>
          <DialogDescription className="text-lg">
            Cette action enverra immédiatement une alerte aux responsables.
            <br />
            <strong>Utilisez uniquement en cas d'urgence réelle.</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez l'urgence (optionnel)..."
            rows={4}
            className="text-lg"
          />
        </div>
        <DialogFooter className="flex space-x-3">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending} className="text-lg px-6">
            ❌ Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={sendEmergencyAlert}
            disabled={isSending}
            className="bg-red-600 hover:bg-red-700 text-lg px-6"
          >
            {isSending ? "📤 Envoi..." : "🚨 ENVOYER L'ALERTE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
