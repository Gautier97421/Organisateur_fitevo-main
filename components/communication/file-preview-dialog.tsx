"use client"

import { useEffect, useState } from "react"
import { Loader2, X, Download, FileText, AlertTriangle } from "lucide-react"
import type { FolderFile } from "./types"
import { odtToHtml } from "./odf-utils"
import { mergeInfo } from "./xlsx-style"

interface FilePreviewDialogProps {
  file: FolderFile
  onClose: () => void
}

type PreviewKind = "image" | "pdf" | "text" | "spreadsheet" | "docx" | "odt" | "unsupported"

function ext(name: string): string {
  return (name.split(".").pop() || "").toLowerCase()
}

function previewKind(file: FolderFile): PreviewKind {
  const mt = (file.mimeType || "").toLowerCase()
  const e = ext(file.fileName)
  if (mt.startsWith("image/")) return "image"
  if (mt === "application/pdf" || e === "pdf") return "pdf"
  if (["xlsx", "xls", "ods", "csv"].includes(e) || mt.includes("spreadsheet") || mt === "application/vnd.ms-excel" || mt === "text/csv") return "spreadsheet"
  if (e === "docx" || mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx"
  if (e === "odt" || mt === "application/vnd.oasis.opendocument.text") return "odt"
  if (mt === "text/plain" || e === "txt") return "text"
  return "unsupported"
}

export function FilePreviewDialog({ file, onClose }: FilePreviewDialogProps) {
  const kind = previewKind(file)
  const inlineUrl = `/api/communication/files/${file.id}?disposition=inline`
  const downloadUrl = `/api/communication/files/${file.id}`

  const [text, setText] = useState<string | null>(null)
  const [sheets, setSheets] = useState<{ name: string; rows: string[][]; styles?: (React.CSSProperties | null)[][]; merges?: string[] }[] | null>(null)
  const [activeSheet, setActiveSheet] = useState(0)
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(kind === "text" || kind === "spreadsheet" || kind === "docx" || kind === "odt")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        if (kind === "text") {
          const res = await fetch(inlineUrl, { credentials: "same-origin" })
          if (!res.ok) throw new Error()
          const t = await res.text()
          if (!cancelled) { setText(t); setLoading(false) }
        } else if (kind === "spreadsheet") {
          const res = await fetch(inlineUrl, { credentials: "same-origin" })
          if (!res.ok) throw new Error()
          const buf = await res.arrayBuffer()
          const e = ext(file.fileName)
          if (e === "xlsx") {
            // .xlsx : rendu fidèle (styles, formats, fusions) via ExcelJS.
            const { loadXlsx } = await import("./xlsx-style")
            const { sheets: loaded } = await loadXlsx(buf)
            const parsed = loaded.map((s) => ({ name: s.name, rows: s.display, styles: s.styles, merges: s.merges }))
            if (!cancelled) { setSheets(parsed); setLoading(false) }
          } else if (e === "ods") {
            // .ods : rendu fidèle (styles, fusions) via parseur OpenDocument.
            const { loadOds } = await import("./ods-style")
            const parsed = await loadOds(buf)
            if (!cancelled) { setSheets(parsed); setLoading(false) }
          } else {
            // .xls / .csv : valeurs uniquement (SheetJS).
            const XLSX = await import("xlsx")
            const wb = XLSX.read(buf, { type: "array" })
            const parsed = wb.SheetNames.map((name) => {
              const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as any[][]
              return { name, rows: aoa.map((r) => r.map((c) => (c == null ? "" : String(c)))) }
            })
            if (!cancelled) { setSheets(parsed); setLoading(false) }
          }
        } else if (kind === "docx") {
          const mammoth = await import("mammoth")
          const res = await fetch(inlineUrl, { credentials: "same-origin" })
          if (!res.ok) throw new Error()
          const buf = await res.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer: buf })
          if (!cancelled) { setDocHtml(result.value); setLoading(false) }
        } else if (kind === "odt") {
          const res = await fetch(inlineUrl, { credentials: "same-origin" })
          if (!res.ok) throw new Error()
          const buf = await res.arrayBuffer()
          const html = await odtToHtml(buf)
          if (!cancelled) { setDocHtml(html); setLoading(false) }
        }
      } catch {
        if (!cancelled) { setError("Impossible de charger l'aperçu."); setLoading(false) }
      }
    }
    run()
    return () => { cancelled = true }
  }, [inlineUrl, kind])

  const sheet = sheets?.[activeSheet]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-2 sm:p-4" onClick={onClose}>
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
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" title="Télécharger"
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
              <Download className="w-5 h-5" />
            </a>
            <button onClick={onClose} title="Fermer"
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 min-h-0 overflow-auto bg-gray-50 dark:bg-gray-950 flex flex-col">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-16 px-6">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white">
                <Download className="w-4 h-4" /> Télécharger
              </a>
            </div>
          )}

          {!loading && !error && kind === "image" && (
            <div className="w-full flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inlineUrl} alt={file.fileName} className="max-w-full max-h-[80vh] object-contain rounded" />
            </div>
          )}

          {!loading && !error && kind === "pdf" && (
            <iframe src={inlineUrl} title={file.fileName} className="w-full h-[80vh] border-0" />
          )}

          {!loading && !error && kind === "text" && (
            <div className="w-full p-4">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">{text}</pre>
            </div>
          )}

          {!loading && !error && (kind === "docx" || kind === "odt") && (
            <div className="w-full p-6 max-w-3xl mx-auto">
              {docHtml && docHtml.trim()
                ? <div className="tiptap-content" dangerouslySetInnerHTML={{ __html: docHtml }} />
                : <p className="text-sm text-gray-400 text-center py-8">Document vide ou illisible.</p>}
            </div>
          )}

          {!loading && !error && kind === "spreadsheet" && sheets && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 overflow-auto p-2">
                {sheet && sheet.rows.length > 0 ? (
                  (() => {
                    const mi = mergeInfo(sheet.merges || [])
                    return (
                      <table className="border-collapse text-sm">
                        <tbody>
                          {sheet.rows.map((row, r) => (
                            <tr key={r}>
                              <td className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 text-center text-xs text-gray-400">{r + 1}</td>
                              {row.map((cell, c) => {
                                const key = `${r},${c}`
                                if (mi.slaves.has(key)) return null
                                const span = mi.masters.get(key)
                                const st = sheet.styles?.[r]?.[c] || undefined
                                // Respecter les retours à la ligne ; sinon, pas de retour automatique.
                                const wrapClass = cell.includes("\n")
                                  ? "whitespace-pre-wrap break-words align-top"
                                  : "whitespace-nowrap"
                                return (
                                  <td
                                    key={c}
                                    rowSpan={span?.rowspan}
                                    colSpan={span?.colspan}
                                    style={st}
                                    className={`border border-gray-200 dark:border-gray-700 px-2 py-1 text-gray-800 dark:text-gray-200 ${wrapClass}`}
                                  >
                                    {cell}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  })()
                ) : (
                  <p className="text-sm text-gray-400 p-4 text-center">Feuille vide</p>
                )}
              </div>
              {sheets.length > 1 && (
                <div className="flex items-center gap-1 px-3 h-9 border-t border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0">
                  {sheets.map((s, i) => (
                    <button key={i} onClick={() => setActiveSheet(i)}
                      className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${i === activeSheet ? "bg-red-50 text-red-600 dark:bg-red-900/30 font-medium" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !error && kind === "unsupported" && (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-16 px-6">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-gray-600 dark:text-gray-300">L'aperçu n'est pas disponible pour ce type de fichier.</p>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white">
                <Download className="w-4 h-4" /> Télécharger
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
