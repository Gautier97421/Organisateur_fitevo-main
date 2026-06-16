"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, X, AlertTriangle, Save, Plus } from "lucide-react"

interface SpreadsheetEditorDialogProps {
  fileId: string
  fileName: string
  onClose: () => void
}

interface SheetData {
  name: string
  rows: string[][]
}

// Étiquette de colonne type tableur : 0 -> A, 1 -> B, 26 -> AA...
function colLabel(index: number): string {
  let s = ""
  let i = index + 1
  while (i > 0) {
    const m = (i - 1) % 26
    s = String.fromCharCode(65 + m) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

function bookTypeFor(name: string): "xlsx" | "ods" | "csv" | "xls" {
  const ext = (name.split(".").pop() || "").toLowerCase()
  if (ext === "ods") return "ods"
  if (ext === "csv") return "csv"
  if (ext === "xls") return "xls"
  return "xlsx"
}

// Convertit une valeur de cellule éditée : nombre si numérique, sinon texte.
function coerce(value: string): string | number {
  const v = value.trim()
  if (v === "") return ""
  if (!isNaN(Number(v)) && /^-?\d*\.?\d+$/.test(v)) return Number(v)
  return value
}

/**
 * Éditeur de tableur (Excel/ods/csv) intégré, basé sur SheetJS.
 * Chargement → grille éditable → enregistrement dans le format d'origine.
 * Édition simple (un éditeur à la fois, pas de collaboration temps réel).
 */
export function SpreadsheetEditorDialog({ fileId, fileName, onClose }: SpreadsheetEditorDialogProps) {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const xlsxRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const XLSX = await import("xlsx")
        xlsxRef.current = XLSX
        const res = await fetch(`/api/communication/files/${fileId}?disposition=inline`, { credentials: "same-origin" })
        if (!res.ok) throw new Error("Lecture du fichier impossible")
        const buf = await res.arrayBuffer()
        const wb = XLSX.read(buf, { type: "array" })
        if (cancelled) return

        const parsed: SheetData[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name]
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: true }) as any[][]
          // Normaliser en grille rectangulaire de chaînes, + marge d'édition.
          const maxCols = aoa.reduce((m, r) => Math.max(m, r.length), 1)
          const cols = maxCols + 2
          const rowsArr = aoa.map((r) => {
            const row = Array.from({ length: cols }, (_, c) => (r[c] !== undefined && r[c] !== null ? String(r[c]) : ""))
            return row
          })
          // Au moins 12 lignes pour pouvoir éditer.
          while (rowsArr.length < 12) rowsArr.push(Array.from({ length: cols }, () => ""))
          return { name, rows: rowsArr }
        })
        setSheets(parsed.length ? parsed : [{ name: "Feuille1", rows: Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => "")) }])
        setLoading(false)
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || "Impossible d'ouvrir le tableur"); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [fileId])

  const setCell = (sheetIdx: number, r: number, c: number, value: string) => {
    setSheets((prev) => {
      const next = prev.map((s) => ({ name: s.name, rows: s.rows.map((row) => [...row]) }))
      next[sheetIdx].rows[r][c] = value
      return next
    })
    setDirty(true)
  }

  const addRow = () => {
    setSheets((prev) => {
      const next = prev.map((s) => ({ name: s.name, rows: s.rows.map((row) => [...row]) }))
      const cols = next[active].rows[0]?.length || 6
      next[active].rows.push(Array.from({ length: cols }, () => ""))
      return next
    })
    setDirty(true)
  }

  const addCol = () => {
    setSheets((prev) => {
      const next = prev.map((s) => ({ name: s.name, rows: s.rows.map((row) => [...row, ""]) }))
      return next
    })
    setDirty(true)
  }

  const save = async () => {
    const XLSX = xlsxRef.current
    if (!XLSX) return
    setSaving(true)
    try {
      const wb = XLSX.utils.book_new()
      for (const sheet of sheets) {
        // Retirer les lignes/colonnes entièrement vides en fin de grille.
        const aoa = sheet.rows.map((row) => row.map((cell) => coerce(cell)))
        const ws = XLSX.utils.aoa_to_sheet(aoa)
        XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || "Feuille")
      }
      const bookType = bookTypeFor(fileName)
      const out = XLSX.write(wb, { bookType, type: "array" })
      const blob = new Blob([out])
      const fd = new FormData()
      fd.append("file", new File([blob], fileName))
      const res = await fetch(`/api/communication/files/${fileId}`, {
        method: "PUT",
        body: fd,
        credentials: "same-origin",
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Échec de l'enregistrement")
      }
      setDirty(false)
    } catch (e: any) {
      setError(e?.message || "Échec de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  const current = sheets[active]

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-gray-900">
      {/* Barre supérieure */}
      <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{fileName}</span>
          {dirty && <span className="text-xs text-amber-500 flex-shrink-0">• non enregistré</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={save}
            disabled={saving || loading || !dirty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-red-600" /><span className="text-sm">Ouverture du tableur…</span></div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">{error}</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white">Fermer</button>
          </div>
        </div>
      ) : (
        <>
          {/* Grille */}
          <div className="flex-1 min-h-0 overflow-auto bg-gray-50 dark:bg-gray-950">
            {current && (
              <table className="border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-20 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-10" />
                    {current.rows[0].map((_, c) => (
                      <th key={c} className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-semibold text-gray-500 min-w-[6rem]">
                        {colLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.rows.map((row, r) => (
                    <tr key={r}>
                      <td className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 text-center text-xs font-semibold text-gray-500">
                        {r + 1}
                      </td>
                      {row.map((cell, c) => (
                        <td key={c} className="border border-gray-200 dark:border-gray-700 p-0">
                          <input
                            value={cell}
                            onChange={(e) => setCell(active, r, c, e.target.value)}
                            className="w-full min-w-[6rem] px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Barre inférieure : onglets de feuilles + ajout ligne/colonne */}
          <div className="flex items-center justify-between gap-2 px-3 h-10 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1">
              {sheets.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${i === active ? "bg-red-50 text-red-600 dark:bg-red-900/30 font-medium" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={addRow} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                <Plus className="w-3 h-3" /> Ligne
              </button>
              <button onClick={addCol} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                <Plus className="w-3 h-3" /> Colonne
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
