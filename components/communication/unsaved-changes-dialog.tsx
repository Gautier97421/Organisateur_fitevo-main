"use client"

import { AlertTriangle, Loader2, Save, X } from "lucide-react"

/**
 * Garde-fou avant de fermer un éditeur qui a des modifications non enregistrées : un clic
 * malheureux sur la croix ne doit pas faire perdre le travail en cours.
 */
export function UnsavedChangesDialog({
  fileName, saving = false, error, onSaveAndClose, onDiscard, onCancel,
}: {
  fileName: string
  saving?: boolean
  error?: string | null
  onSaveAndClose: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Modifications non enregistrées</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          « {fileName} » contient des modifications qui ne sont pas encore enregistrées.
          Si vous fermez maintenant, elles seront perdues.
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onSaveAndClose}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer et fermer
          </button>
          <button
            onClick={onDiscard}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Fermer sans enregistrer
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
