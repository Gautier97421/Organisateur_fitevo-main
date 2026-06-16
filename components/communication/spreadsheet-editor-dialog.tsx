"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { Loader2, X, AlertTriangle, Save, Plus, Minus } from "lucide-react"
import { loadXlsx, saveXlsx, mergeInfo } from "./xlsx-style"

interface SpreadsheetEditorDialogProps {
  fileId: string
  fileName: string
  onClose: () => void
}

interface SheetData {
  name: string
  rows: string[][]
  styles?: (CSSProperties | null)[][]
  merges?: string[]
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

function computeDisplay(rows: string[][], FormulaParser: any): string[][] {
  const memo = new Map<string, any>()
  const inProgress = new Set<string>()

  const get = (r: number, c: number): any => {
    const key = `${r}:${c}`
    if (memo.has(key)) return memo.get(key)
    if (inProgress.has(key)) return 0
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

export function SpreadsheetEditorDialog({ fileId, fileName, onClose }: SpreadsheetEditorDialogProps) {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null)
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null)
  const [fillAnchor, setFillAnchor] = useState<{ r: number; c: number } | null>(null)
  const [fillTarget, setFillTarget] = useState<{ r: number; c: number } | null>(null)
  const xlsxRef = useRef<any>(null)
  const wbRef = useRef<any>(null)
  const engineRef = useRef<"excel" | "sheetjs">("sheetjs")
  const [FormulaParser, setFormulaParser] = useState<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const formulaRefInserted = useRef(false)

  useEffect(() => {
    let cancelled = false
    const isXlsx = (fileName.split(".").pop() || "").toLowerCase() === "xlsx"
    const load = async () => {
      try {
        const [XLSX, fp] = await Promise.all([import("xlsx"), import("fast-formula-parser")])
        xlsxRef.current = XLSX
        setFormulaParser(() => (fp as any).FormulaParser || (fp as any).default)
        const res = await fetch(`/api/communication/files/${fileId}?disposition=inline`, { credentials: "same-origin" })
        if (!res.ok) throw new Error("Lecture du fichier impossible")
        const buf = await res.arrayBuffer()
        if (cancelled) return

        if (isXlsx) {
          engineRef.current = "excel"
          const { wb, sheets } = await loadXlsx(buf)
          if (cancelled) return
          wbRef.current = wb
          const parsed: SheetData[] = sheets.map((s) => ({ name: s.name, rows: s.rows, styles: s.styles, merges: s.merges }))
          setSheets(parsed.length ? parsed : [{ name: "Feuille1", rows: Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => "")) }])
        } else {
          engineRef.current = "sheetjs"
          const wb = XLSX.read(buf, { type: "array", cellFormula: true })
          const parsed: SheetData[] = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name]
            const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
            const cols = range.e.c + 1 + 2
            const rowCount = Math.max(range.e.r + 1, 12)
            const rows: string[][] = []
            for (let r = 0; r < rowCount; r++) {
              const row: string[] = []
              for (let c = 0; c < cols; c++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c })]
                if (!cell) { row.push(""); continue }
                if (cell.f) row.push("=" + cell.f)
                else row.push(cell.v != null ? String(cell.v) : "")
              }
              rows.push(row)
            }
            return { name, rows }
          })
          setSheets(parsed.length ? parsed : [{ name: "Feuille1", rows: Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => "")) }])
        }
        setLoading(false)
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || "Impossible d'ouvrir le tableur"); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [fileId, fileName])

  // Fermeture menu contextuel au clic extérieur
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [contextMenu])

  // Curseur crosshair pendant le fill drag
  useEffect(() => {
    if (fillAnchor) {
      document.body.style.cursor = "crosshair"
      document.body.style.userSelect = "none"
    } else {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    return () => { document.body.style.cursor = ""; document.body.style.userSelect = "" }
  }, [!!fillAnchor])

  // Fin du drag fill → appliquer le remplissage
  useEffect(() => {
    const handleMouseUp = () => {
      if (fillAnchor && fillTarget &&
        (fillAnchor.r !== fillTarget.r || fillAnchor.c !== fillTarget.c)) {
        const anchor = fillAnchor
        const target = fillTarget
        const dr = target.r - anchor.r
        const dc = target.c - anchor.c
        setSheets(prev => {
          const next = cloneSheets(prev)
          const sheet = next[active]
          if (!sheet) return prev
          const sourceVal = sheet.rows[anchor.r]?.[anchor.c] ?? ""

          if (Math.abs(dr) >= Math.abs(dc) && dr > 0) {
            // Remplissage vers le bas
            const prevVal = sheet.rows[anchor.r - 1]?.[anchor.c] ?? ""
            const step = (prevVal !== "" && isNumeric(prevVal) && isNumeric(sourceVal))
              ? Number(sourceVal) - Number(prevVal) : null
            for (let i = 1; i <= dr; i++) {
              const tr = anchor.r + i
              while (sheet.rows.length <= tr)
                sheet.rows.push(Array.from({ length: sheet.rows[0]?.length || 6 }, () => ""))
              sheet.rows[tr][anchor.c] = step !== null
                ? String(Number(sourceVal) + step * i) : sourceVal
            }
          } else if (Math.abs(dc) > Math.abs(dr) && dc > 0) {
            // Remplissage vers la droite
            const prevVal = sheet.rows[anchor.r]?.[anchor.c - 1] ?? ""
            const step = (prevVal !== "" && isNumeric(prevVal) && isNumeric(sourceVal))
              ? Number(sourceVal) - Number(prevVal) : null
            for (let i = 1; i <= dc; i++) {
              const tc = anchor.c + i
              while ((sheet.rows[anchor.r]?.length ?? 0) <= tc)
                sheet.rows[anchor.r].push("")
              sheet.rows[anchor.r][tc] = step !== null
                ? String(Number(sourceVal) + step * i) : sourceVal
            }
          }
          return next
        })
        setDirty(true)
      }
      setFillAnchor(null)
      setFillTarget(null)
    }
    window.addEventListener("mouseup", handleMouseUp)
    return () => window.removeEventListener("mouseup", handleMouseUp)
  }, [fillAnchor, fillTarget, active])

  const current = sheets[active]
  const isFormulaMode = editing !== null && current != null &&
    (current.rows[editing.r]?.[editing.c] ?? "").startsWith("=")

  const display = useMemo(
    () => (FormulaParser && current ? computeDisplay(current.rows, FormulaParser) : null),
    [FormulaParser, current],
  )

  // Clone profond pour mutations
  const cloneSheets = (arr: SheetData[]): SheetData[] =>
    arr.map((s) => ({
      name: s.name,
      rows: s.rows.map((row) => [...row]),
      styles: s.styles ? s.styles.map((row) => [...row]) : undefined,
      merges: s.merges ? [...s.merges] : undefined,
    }))

  const setCell = (r: number, c: number, value: string) => {
    setSheets((prev) => {
      const next = cloneSheets(prev)
      next[active].rows[r][c] = value
      return next
    })
    setDirty(true)
  }

  // ── Insertion / suppression de lignes et colonnes ───────────────
  const insertRowAbove = (r: number) => {
    setSheets(prev => {
      const next = cloneSheets(prev)
      const sheet = next[active]
      const cols = sheet.rows[0]?.length || 6
      sheet.rows.splice(r, 0, Array.from({ length: cols }, () => ""))
      if (sheet.styles) sheet.styles.splice(r, 0, Array.from({ length: cols }, () => null))
      return next
    })
    setDirty(true)
    setContextMenu(null)
  }

  const insertRowBelow = (r: number) => {
    setSheets(prev => {
      const next = cloneSheets(prev)
      const sheet = next[active]
      const cols = sheet.rows[0]?.length || 6
      sheet.rows.splice(r + 1, 0, Array.from({ length: cols }, () => ""))
      if (sheet.styles) sheet.styles.splice(r + 1, 0, Array.from({ length: cols }, () => null))
      return next
    })
    setDirty(true)
    setContextMenu(null)
  }

  const deleteRow = (r: number) => {
    setSheets(prev => {
      const next = cloneSheets(prev)
      const sheet = next[active]
      if (sheet.rows.length <= 1) return next
      sheet.rows.splice(r, 1)
      if (sheet.styles) sheet.styles.splice(r, 1)
      return next
    })
    setDirty(true)
    setContextMenu(null)
  }

  const insertColLeft = (c: number) => {
    setSheets(prev => {
      const next = cloneSheets(prev)
      const sheet = next[active]
      sheet.rows = sheet.rows.map(row => { const r = [...row]; r.splice(c, 0, ""); return r })
      if (sheet.styles) sheet.styles = sheet.styles.map(row => { const r = [...row]; r.splice(c, 0, null); return r })
      return next
    })
    setDirty(true)
    setContextMenu(null)
  }

  const insertColRight = (c: number) => {
    setSheets(prev => {
      const next = cloneSheets(prev)
      const sheet = next[active]
      sheet.rows = sheet.rows.map(row => { const r = [...row]; r.splice(c + 1, 0, ""); return r })
      if (sheet.styles) sheet.styles = sheet.styles.map(row => { const r = [...row]; r.splice(c + 1, 0, null); return r })
      return next
    })
    setDirty(true)
    setContextMenu(null)
  }

  const deleteCol = (c: number) => {
    setSheets(prev => {
      const next = cloneSheets(prev)
      const sheet = next[active]
      if ((sheet.rows[0]?.length ?? 0) <= 1) return next
      sheet.rows = sheet.rows.map(row => { const r = [...row]; r.splice(c, 1); return r })
      if (sheet.styles) sheet.styles = sheet.styles.map(row => { const r = [...row]; r.splice(c, 1); return r })
      return next
    })
    setDirty(true)
    setContextMenu(null)
  }

  // ── Interactions cellules ───────────────────────────────────────
  const handleCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
    formulaRefInserted.current = false
    // Mode formule : cliquer une autre cellule insère sa référence
    if (isFormulaMode && editing && !(editing.r === r && editing.c === c)) {
      e.preventDefault() // Empêche le changement de focus
      const ref = colLabel(c) + (r + 1)
      const ta = textareaRef.current
      if (ta) {
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const currentVal = current.rows[editing.r][editing.c]
        const newVal = currentVal.slice(0, start) + ref + currentVal.slice(end)
        setCell(editing.r, editing.c, newVal)
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(start + ref.length, start + ref.length)
            textareaRef.current.focus()
          }
        })
      }
      formulaRefInserted.current = true
    }
  }

  const handleContextMenu = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 210)
    const y = Math.min(e.clientY, window.innerHeight - 260)
    setContextMenu({ x, y, r, c })
  }

  const inFillRange = (r: number, c: number): boolean => {
    if (!fillAnchor || !fillTarget) return false
    const dr = fillTarget.r - fillAnchor.r
    const dc = fillTarget.c - fillAnchor.c
    if (dr === 0 && dc === 0) return false
    if (Math.abs(dr) >= Math.abs(dc)) {
      if (dr > 0) return c === fillAnchor.c && r > fillAnchor.r && r <= fillTarget.r
      if (dr < 0) return c === fillAnchor.c && r >= fillTarget.r && r < fillAnchor.r
    } else {
      if (dc > 0) return r === fillAnchor.r && c > fillAnchor.c && c <= fillTarget.c
      if (dc < 0) return r === fillAnchor.r && c >= fillTarget.c && c < fillAnchor.c
    }
    return false
  }

  const addRow = () => {
    setSheets((prev) => {
      const next = cloneSheets(prev)
      const cols = next[active].rows[0]?.length || 6
      next[active].rows.push(Array.from({ length: cols }, () => ""))
      if (next[active].styles) next[active].styles!.push(Array.from({ length: cols }, () => null))
      return next
    })
    setDirty(true)
  }

  const addCol = () => {
    setSheets((prev) => {
      const next = cloneSheets(prev)
      next[active].rows = next[active].rows.map((row) => [...row, ""])
      if (next[active].styles) next[active].styles = next[active].styles!.map((row) => [...row, null])
      return next
    })
    setDirty(true)
  }

  const save = async () => {
    const XLSX = xlsxRef.current
    if (!XLSX) return
    setSaving(true)
    try {
      if (engineRef.current === "excel" && wbRef.current) {
        const out = await saveXlsx(wbRef.current, sheets.map((s) => ({ name: s.name, rows: s.rows })))
        const fd = new FormData()
        fd.append("file", new File([new Blob([out as BlobPart])], fileName))
        const res = await fetch(`/api/communication/files/${fileId}`, { method: "PUT", body: fd, credentials: "same-origin" })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || "Échec de l'enregistrement")
        }
        setDirty(false)
        setSaving(false)
        return
      }

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
              ws[addr] = { t: "n", f: v.slice(1) }
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

  // Barre de formule (affiche le contenu brut de la cellule active)
  const formulaBarValue = editing
    ? (current?.rows[editing.r]?.[editing.c] ?? "")
    : selected
      ? (current?.rows[selected.r]?.[selected.c] ?? "")
      : ""
  const formulaBarLabel = editing
    ? `${colLabel(editing.c)}${editing.r + 1}`
    : selected
      ? `${colLabel(selected.c)}${selected.r + 1}`
      : ""

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-gray-900" onClick={() => setContextMenu(null)}>
      {/* En-tête */}
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

      {/* Barre de formule */}
      {!loading && !error && (
        <div className="flex items-center gap-2 px-3 h-9 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 bg-white dark:bg-gray-900">
          <span className="text-xs font-mono text-gray-500 w-12 text-center flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5">
            {formulaBarLabel || "—"}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">fx</span>
          <span className="flex-1 text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
            {formulaBarValue || (isFormulaMode ? "Cliquez une cellule pour insérer sa référence" : "")}
          </span>
          {isFormulaMode && (
            <span className="text-xs text-blue-500 flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
              Mode formule — cliquez une cellule
            </span>
          )}
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
              <table className="border-collapse text-sm select-none">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-20 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-10" />
                    {current.rows[0].map((_, c) => (
                      <th key={c}
                        className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-semibold text-gray-500 min-w-[7rem]"
                        onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e, 0, c) }}>
                        {colLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const mi = mergeInfo(current.merges || [])
                    return current.rows.map((row, r) => (
                      <tr key={r}>
                        <td
                          className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 text-center text-xs font-semibold text-gray-500 align-top cursor-default select-none"
                          onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e, r, 0) }}
                        >
                          {r + 1}
                        </td>
                        {row.map((raw, c) => {
                          const key = `${r},${c}`
                          if (mi.slaves.has(key)) return null
                          const span = mi.masters.get(key)
                          const isEditing = editing?.r === r && editing?.c === c
                          const isSelected = !isEditing && selected?.r === r && selected?.c === c
                          const isFilling = inFillRange(r, c)
                          const shown = isEditing ? raw : (display?.[r]?.[c] ?? raw)
                          const st = current.styles?.[r]?.[c] || undefined

                          return (
                            <td
                              key={c}
                              rowSpan={span?.rowspan}
                              colSpan={span?.colspan}
                              className={[
                                "border border-gray-200 dark:border-gray-700 p-0 relative min-w-[7rem] max-w-[20rem] align-top",
                                isFilling ? "bg-blue-50 dark:bg-blue-900/20" : "",
                                isSelected ? "outline outline-2 outline-red-500 -outline-offset-1 z-[5]" : "",
                                isEditing ? "z-[6]" : "",
                              ].join(" ")}
                              onMouseDown={(e) => handleCellMouseDown(e, r, c)}
                              onClick={() => {
                                if (formulaRefInserted.current) { formulaRefInserted.current = false; return }
                                if (isEditing) return
                                setSelected({ r, c })
                                setEditing({ r, c })
                              }}
                              onMouseEnter={() => { if (fillAnchor) setFillTarget({ r, c }) }}
                              onContextMenu={(e) => handleContextMenu(e, r, c)}
                            >
                              {isEditing ? (
                                <textarea
                                  ref={textareaRef}
                                  autoFocus
                                  value={raw}
                                  onChange={(e) => setCell(r, c, e.target.value)}
                                  onBlur={() => setEditing(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") { e.preventDefault(); setEditing(null) }
                                    if (e.key === "Tab") {
                                      e.preventDefault()
                                      setEditing(null)
                                      const nc = c + 1
                                      if (nc < (current.rows[r]?.length || 0)) {
                                        setSelected({ r, c: nc })
                                        setTimeout(() => setEditing({ r, c: nc }), 0)
                                      }
                                    }
                                  }}
                                  rows={Math.min(8, Math.max(1, raw.split("\n").length))}
                                  style={st}
                                  className="w-full px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-red-500 whitespace-pre-wrap"
                                />
                              ) : (
                                <div
                                  style={st}
                                  className="min-h-[2rem] px-2 py-1 whitespace-pre-wrap break-words text-gray-900 dark:text-white pointer-events-none"
                                >
                                  {shown}
                                </div>
                              )}

                              {/* Poignée de remplissage (bas-droite de la cellule sélectionnée) */}
                              {isSelected && !fillAnchor && (
                                <div
                                  className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-red-600 border border-white z-10 cursor-crosshair"
                                  style={{ transform: "translate(50%, 50%)" }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setFillAnchor({ r, c })
                                    setFillTarget({ r, c })
                                  }}
                                />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            )}
          </div>

          {/* Barre du bas : onglets + ajouter ligne/colonne */}
          <div className="flex items-center justify-between gap-2 px-3 h-10 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1">
              {sheets.map((s, i) => (
                <button key={i} onClick={() => { setActive(i); setEditing(null); setSelected(null) }}
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

      {/* Menu contextuel clic droit */}
      {contextMenu && (
        <div
          className="fixed z-[300] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 text-sm min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button onClick={() => insertRowAbove(contextMenu.r)} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <Plus className="w-3.5 h-3.5 text-green-500" /> Insérer ligne au-dessus
          </button>
          <button onClick={() => insertRowBelow(contextMenu.r)} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <Plus className="w-3.5 h-3.5 text-green-500" /> Insérer ligne en-dessous
          </button>
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          <button onClick={() => insertColLeft(contextMenu.c)} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <Plus className="w-3.5 h-3.5 text-blue-500" /> Insérer colonne à gauche
          </button>
          <button onClick={() => insertColRight(contextMenu.c)} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <Plus className="w-3.5 h-3.5 text-blue-500" /> Insérer colonne à droite
          </button>
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          <button onClick={() => deleteRow(contextMenu.r)} className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600">
            <Minus className="w-3.5 h-3.5" /> Supprimer la ligne
          </button>
          <button onClick={() => deleteCol(contextMenu.c)} className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600">
            <Minus className="w-3.5 h-3.5" /> Supprimer la colonne
          </button>
        </div>
      )}
    </div>
  )
}
