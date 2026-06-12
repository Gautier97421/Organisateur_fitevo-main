"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ShieldCheck, Scale, FileText, Download, Trash2, ExternalLink,
  AlertTriangle, Loader2, CheckCircle2,
} from "lucide-react"

interface SimpleUser {
  id: string
  name: string
  email: string
  role: string
}

export function SettingsManager() {
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [confirmErase, setConfirmErase] = useState(false)
  const [isErasing, setIsErasing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/db/users")
        if (!res.ok) return
        const data = await res.json()
        const list: SimpleUser[] = (data.data || [])
          .filter((u: any) => u.is_active !== false && u.active !== false)
          .map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
        setUsers(list)
      } catch {}
    }
    load()
  }, [])

  const selectedUser = users.find((u) => u.id === selectedUserId)

  const handleExport = async () => {
    if (!selectedUserId) return
    setIsExporting(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/account/export?userId=${selectedUserId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erreur lors de l'export")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `donnees-${selectedUserId}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setFeedback({ type: "success", text: "Export téléchargé avec succès." })
    } catch (e: any) {
      setFeedback({ type: "error", text: e.message || "Erreur lors de l'export." })
    } finally {
      setIsExporting(false)
    }
  }

  const handleErase = async () => {
    if (!selectedUserId) return
    setIsErasing(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/account/erase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'anonymisation")
      setFeedback({ type: "success", text: data.message || "Compte anonymisé." })
      setConfirmErase(false)
      setSelectedUserId("")
      setUsers((prev) => prev.filter((u) => u.id !== selectedUserId))
    } catch (e: any) {
      setFeedback({ type: "error", text: e.message || "Erreur lors de l'anonymisation." })
    } finally {
      setIsErasing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="w-6 h-6 text-red-600 flex-shrink-0" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres & confidentialité</h2>
      </div>

      {/* Documents légaux */}
      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white text-lg">
            <FileText className="w-5 h-5 text-gray-400" />
            Documents légaux
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <a
            href="/confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors group"
          >
            <ShieldCheck className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Politique de confidentialité</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Données, finalités, durées, droits</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-red-400" />
          </a>
          <a
            href="/mentions-legales"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors group"
          >
            <Scale className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Mentions légales</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Éditeur, hébergeur, cookies</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-red-400" />
          </a>
        </CardContent>
      </Card>

      {/* Droits RGPD */}
      <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white text-lg">
            <ShieldCheck className="w-5 h-5 text-gray-400" />
            Droits des utilisateurs (RGPD)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Export des données (Art. 20)</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Le <strong>droit à la portabilité</strong> permet à un utilisateur de récupérer toutes
                les données que l'application détient sur lui (plannings, pointages, événements, messages…)
                sous un format lisible (JSON). En tant qu'admin, vous générez ce fichier à sa demande et
                le lui transmettez.
              </p>
            </div>
            <div className="rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Droit à l'effacement (Art. 17)</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Le <strong>droit à l'oubli</strong> oblige l'application à supprimer ou anonymiser toutes
                les données personnelles d'un utilisateur sur sa demande. Le compte est désactivé et toutes
                ses informations (nom, email, photo…) sont remplacées par des valeurs anonymes.{" "}
                <strong className="text-red-600 dark:text-red-400">Action irréversible.</strong>
              </p>
            </div>
          </div>

          {/* Sélecteur d'utilisateur */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Utilisateur concerné
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value)
                setConfirmErase(false)
                setFeedback(null)
              }}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
            >
              <option value="">— Choisir un utilisateur —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) · {u.role}
                </option>
              ))}
            </select>
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={[
                "flex items-start gap-2 p-3 rounded-lg text-sm",
                feedback.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300"
                  : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300",
              ].join(" ")}
            >
              {feedback.type === "success"
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleExport}
              disabled={!selectedUserId || isExporting}
              variant="outline"
              className="flex-1 border-gray-300 dark:border-gray-600"
            >
              {isExporting
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Download className="w-4 h-4 mr-2" />}
              Exporter les données (Art. 20)
            </Button>

            <Button
              onClick={() => setConfirmErase(true)}
              disabled={!selectedUserId || isErasing || confirmErase}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Droit à l'effacement (Art. 17)
            </Button>
          </div>

          {/* Confirmation d'effacement */}
          {confirmErase && selectedUser && (
            <div className="p-4 rounded-lg border-2 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-semibold mb-1">Confirmer l'anonymisation de ce compte ?</p>
                  <p>
                    Les données personnelles de <strong>{selectedUser.name}</strong> ({selectedUser.email})
                    seront définitivement remplacées par des valeurs anonymes (nom, email, pseudo, photo,
                    messages) et le compte sera désactivé. <strong>Cette action est irréversible.</strong>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleErase}
                  disabled={isErasing}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  size="sm"
                >
                  {isErasing
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Trash2 className="w-4 h-4 mr-2" />}
                  Confirmer l'anonymisation
                </Button>
                <Button
                  onClick={() => setConfirmErase(false)}
                  disabled={isErasing}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 dark:border-gray-600"
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
