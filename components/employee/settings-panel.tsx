"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Scale, FileText, Download, Loader2, ExternalLink, User } from "lucide-react"

interface SettingsPanelProps {
  userId: string
  userName: string
  userEmail: string
}

/**
 * Paramètres côté employé : informations du compte, export RGPD de ses propres
 * données et accès aux documents légaux.
 */
export function SettingsPanel({ userId, userName, userEmail }: SettingsPanelProps) {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportData = async () => {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/account/export?userId=${userId}`, { credentials: "same-origin" })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || "Export impossible")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `mes-donnees-${userId}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || "Export impossible")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-base">Paramètres</h2>
          <p className="text-xs text-gray-500">Compte, données personnelles et documents légaux</p>
        </div>
      </div>

      {/* Compte */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><User className="w-4 h-4 text-gray-500" /> Mon compte</p>
        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="text-gray-400">Nom :</span> {userName || "—"}</p>
          <p><span className="text-gray-400">Email :</span> {userEmail || "—"}</p>
        </div>
      </div>

      {/* RGPD : export */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Mes données (RGPD)</p>
        <p className="text-xs text-gray-500">
          Téléchargez l'ensemble de vos données personnelles dans un format structuré (JSON).
          Pour la suppression de votre compte, contactez un administrateur.
        </p>
        <Button onClick={exportData} disabled={exporting} className="bg-red-600 hover:bg-red-700 text-white">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
          Exporter mes données
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Documents légaux */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-800">Documents légaux</p>
        <div className="flex flex-col gap-1">
          <a href="/mentions-legales" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 py-1.5">
            <Scale className="w-4 h-4 text-gray-400" /> Mentions légales <ExternalLink className="w-3 h-3 text-gray-300" />
          </a>
          <a href="/confidentialite" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 py-1.5">
            <FileText className="w-4 h-4 text-gray-400" /> Politique de confidentialité <ExternalLink className="w-3 h-3 text-gray-300" />
          </a>
        </div>
      </div>
    </div>
  )
}
