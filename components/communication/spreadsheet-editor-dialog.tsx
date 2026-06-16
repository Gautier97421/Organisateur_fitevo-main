"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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

function isNumeric(v: string): boolean {
  return v.trim() !== "" && !isNaN(Number(v)) && /^-?\d*\.?\d+$/.test(v.trim())
}

/**
 * Calcule la matrice des valeurs affichées (résultats des formules) d'une feuille.
 * Les cellules commençant par "=" sont des formules évaluées via fast-formula-parser.
 */
function computeDisplay(rows: string[][], FormulaParser: any): string[][] {
  const memo = new Map<string, any>()
  const inProgress = new Set<string>()

  const get = (r: number, c: number): any => {
    const key = `${r}:${c}`
    if (memo.has(key)) return memo.get(key)
    if (inProgress.has(key)) return 0 // protection anti-cycle
    const raw = rows[r] && rows[r][c] != null ? String(rows[r][c]) : ""
    if (!raw.startsWith("=")) {
      const val = isNumeric(raw) ? Number(raw) : raw
      memo.set(key, val)
      return val
    }
    inProgress.add(key)
    let result: any
    try {
      const parser = new FormulaParser({
        onCell: ({ row, col }: { row: number; col: number }) => get(row - 1, col - 1),
        onRange: ({ from, to }: any) => {
          const a: any[][] = []
          for (let R = from.row; R <= to.row; R++) {
            const line: any[] = []
            for (let C = from.col; C <= to.col; C++) line.push(get(R - 1, C - 1))
            a.push(line)
          }
          return a
        },
      })
      result = parser.parse(raw.slice(1), { row: r + 1, col: c + 1 })
    } catch {
      result = "#ERREUR"
    }
    inProgress.delete(key)
    memo.set(key, result)
    return result
  }

  return rows.map((row, r) =>
    row.map((_, c) => {
      const v = get(r, c)
      if (v == null) return ""
      return String(v)
    }),
  )
}

/**
 * Éditeur de tableur intégré (Excel/ods/csv) basé sur SheetJS, avec moteur de
 * formules (SUM, IF, A1+B2…) et retour à la ligne dans les cellules.
 */
export function SpreadsheetEditorDialog({ fileId, fileName, onClose }: SpreadsheetEditorDialogProps) {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null)
  const xlsxRef = useRef<any>(null)
  const [FormulaParser, setFormulaParser] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [XLSX, fp] = await Promise.all([import("xlsx"), import("fast-formula-parser")])
        xlsxRef.current = XLSX
        setFormulaParser(() => (fp as any).FormulaParser || (fp as any).default)
        const res = await fetch(`/api/communication/files/${fileId}?disposition=inline`, { credentials: "same-origin" })
        if (!res.ok) throw new Error("Lecture du fichier impossible")
        const buf = await res.arrayBuffer()
        const wb = XLSX.read(buf, { type: "array", cellFormula: true })
        if (cancelled) return

        const parsed: SheetData[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name]
          const ref = ws["!ref"] || "A1"
          const range = XLSX.utils.decode_range(ref)
          const cols = range.e.c + 1 + 2
          const rowCount = Math.max(range.e.r + 1, 12)
          const rows: string[][] = []
          for (let r = 0; r < rowCount; r++) {
            const row: string[] = []
            for (let c = 0; c < cols; c++) {
              const cell = ws[XLSX.utils.encode_cell({ r, c })]
              if (!cell) { row.push(""); continue }
              // Préserver la formule si présente, sinon la valeur.
              if (cell.f) row.push("=" + cell.f)
              else row.push(cell.v != null ? String(cell.v) : "")
            }
            rows.push(row)
          }
          return { name, rows }
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

  const current = sheets[active]
  const display = useMemo(
    () => (FormulaParser && current ? computeDisplay(current.rows, FormulaParser) : null),
    [FormulaParser, current],
  )

  const setCell = (r: number, c: number, value: string) => {
    setSheets((prev) => {
      const next = prev.map((s) => ({ name: s.name, rows: s.rows.map((row) => [...row]) }))
      next[active].rows[r][c] = value
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
    setSheets((prev) => prev.map((s) => ({ name: s.name, rows: s.rows.map((row) => [...row, ""]) })))
    setDirty(true)
  }

  const save = async () => {
    const XLSX = xlsxRef.current
    if (!XLSX) return
    setSaving(true)
    try {
      const wb = XLSX.utils.book_new()
      for (const sheet of sheets) {
        const ws: any = {}
        let maxR = 0
        let maxC = 0
        sheet.rows.forEach((row, r) => {
          row.forEach((raw, c) => {
            const v = String(raw ?? "")
            if (v === "") return
            const addr = XLSX.utils.encode_cell({ r, c })
            if (v.startsWith("=")) {
              ws[addr] = { t: "n", f: v.slice(1) } // formule préservée
            } else if (isNumeric(v)) {
              ws[addr] = { t: "n", v: Number(v) }
            } else {
              ws[addr] = { t: "s", v }
            }
            maxR = Math.max(maxR, r)
            maxC = Math.max(maxC, c)
          })
        })
        ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } })
        XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || "Feuille")
      }
      const out = XLSX.write(wb, { bookType: bookTypeFor(fileName), type: "array" })
      const fd = new FormData()
      fd.append("file", new File([new Blob([out])], fileName))
      const res = await fetch(`/api/communication/files/${fileId}`, { method: "PUT", body: fd, credentials: "same-origin" })
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

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{fileName}</span>
          {dirty && <span className="text-xs text-amber-500 flex-shrink-0">• non enregistré</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={save} disabled={saving || loading || !dirty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Aide formules */}
      {!loading && !error && (
        <div className="px-4 py-1 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          Astuce : commencez une cellule par <span className="font-mono text-gray-500">=</span> pour un calcul — ex.
          <span className="font-mono text-gray-500"> =SOMME(A1:A5)</span>, <span className="font-mono text-gray-500">=A1+B2</span>, <span className="font-mono text-gray-500">=SI(A1&gt;0;"ok";"non")</span>. Entrée = retour à la ligne dans la cellule.
        </div>
      )}

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
          <div className="flex-1 min-h-0 overflow-auto bg-gray-50 dark:bg-gray-950">
            {current && (
              <table className="border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-20 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-10" />
                    {current.rows[0].map((_, c) => (
                      <th key={c} className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-semibold text-gray-500 min-w-[7rem]">
                        {colLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.rows.map((row, r) => (
                    <tr key={r}>
                      <td className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 text-center text-xs font-semibold text-gray-500 align-top">
                        {r + 1}
                      </td>
                      {row.map((raw, c) => {
                        const isEditing = editing?.r === r && editing?.c === c
                        const shown = isEditing ? raw : (display?.[r]?.[c] ?? raw)
                        return (
                          <td key={c} className="border border-gray-200 dark:border-gray-700 p-0 align-top min-w-[7rem] max-w-[20rem]">
                            {isEditing ? (
                              <textarea
                                autoFocus
                                value={raw}
                                onChange={(e) => setCell(r, c, e.target.value)}
                                onBlur={() => setEditing(null)}
                                rows={Math.min(8, Math.max(1, raw.split("\n").length))}
                                className="w-full px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-red-500 whitespace-pre-wrap"
                              />
                            ) : (
                              <div
                                onClick={() => setEditing({ r, c })}
                                className="min-h-[2rem] px-2 py-1 whitespace-pre-wrap break-words cursor-text text-gray-900 dark:text-white"
                              >
                                {shown}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-3 h-10 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1">
              {sheets.map((s, i) => (
                <button key={i} onClick={() => { setActive(i); setEditing(null) }}
                  className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${i === active ? "bg-red-50 text-red-600 dark:bg-red-900/30 font-medium" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
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
