"use client"

import { useEffect, useState } from "react"
import { Loader2, X, Download, FileText, AlertTriangle } from "lucide-react"
import type { FolderFile } from "./types"

interface FilePreviewDialogProps {
  file: FolderFile
  onClose: () => void
}

type PreviewKind = "image" | "pdf" | "text" | "unsupported"

function previewKind(file: FolderFile): PreviewKind {
  const mt = (file.mimeType || "").toLowerCase()
  const ext = (file.fileName.split(".").pop() || "").toLowerCase()
  if (mt.startsWith("image/")) return "image"
  if (mt === "application/pdf" || ext === "pdf") return "pdf"
  if (mt === "text/plain" || mt === "text/csv" || ext === "txt" || ext === "csv") return "text"
  return "unsupported"
}

/**
 * Aperçu d'un fichier directement sur le site (modale responsive) :
 * images, PDF et fichiers texte. Les autres types proposent le téléchargement.
 */
export function FilePreviewDialog({ file, onClose }: FilePreviewDialogProps) {
  const kind = previewKind(file)
  const inlineUrl = `/api/communication/files/${file.id}?disposition=inline`
  const downloadUrl = `/api/communication/files/${file.id}`

  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(kind === "text")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fermer avec Échap
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    if (kind !== "text") return
    let cancelled = false
    setLoading(true)
    fetch(inlineUrl, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("Lecture impossible")
        return res.text()
      })
      .then((t) => { if (!cancelled) { setText(t); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError("Impossible de charger l'aperçu."); setLoading(false) } })
    return () => { cancelled = true }
  }, [inlineUrl, kind])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.fileName}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Télécharger"
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              title="Fermer"
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 min-h-0 overflow-auto bg-gray-50 dark:bg-gray-950 flex items-stretch justify-center">
          {kind === "image" && (
            <div className="w-full flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inlineUrl} alt={file.fileName} className="max-w-full max-h-[80vh] object-contain rounded" />
            </div>
          )}

          {kind === "pdf" && (
            <iframe src={inlineUrl} title={file.fileName} className="w-full h-[80vh] border-0" />
          )}

          {kind === "text" && (
            <div className="w-full p-4">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : error ? (
                <p className="text-center text-sm text-gray-500 py-16">{error}</p>
              ) : (
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                  {text}
                </pre>
              )}
            </div>
          )}

          {kind === "unsupported" && (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-16 px-6">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                L'aperçu n'est pas disponible pour ce type de fichier.
              </p>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                <Download className="w-4 h-4" /> Télécharger
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
