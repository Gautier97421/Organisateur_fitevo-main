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
import { XCircle, AlertTriangle, Send, CheckCircle } from "lucide-react"
import { toast } from "sonner"

export function EmergencyButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const sendEmergencyAlert = async () => {
    setIsSending(true)
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "emergency", data: { message } }),
      })
      if (res.ok) {
        toast.success("Alerte envoyée aux responsables")
      } else {
        toast.error("Erreur lors de l'envoi de l'alerte")
      }
    } catch {
      toast.error("Impossible d'envoyer l'alerte")
    } finally {
      setMessage("")
      setIsOpen(false)
      setIsSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 text-xs bg-red-600 hover:bg-red-700 flex items-center gap-1.5 animate-pulse"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Urgence
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 text-xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Alerte d'Urgence
          </DialogTitle>
          <DialogDescription className="text-sm">
            Cette action enverra immédiatement une alerte aux responsables.{" "}
            <strong>Utilisez uniquement en cas d'urgence réelle.</strong>
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Décrivez l'urgence (optionnel)..."
          rows={4}
          className="text-sm"
        />
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending} className="border-gray-300 flex items-center gap-2">
            <XCircle className="h-4 w-4" /> Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={sendEmergencyAlert}
            disabled={isSending}
            className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
          >
            {isSending ? (
              <><Send className="h-4 w-4 animate-pulse" /> Envoi en cours...</>
            ) : (
              <><AlertTriangle className="h-4 w-4" /> Envoyer l'alerte</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
