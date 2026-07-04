// Lecture/écriture de classeurs Excel (.xlsx) en CONSERVANT les styles
// (polices, couleurs, alignement, bordures, formats de nombre, fusions) via ExcelJS.
// Utilisé par l'éditeur de tableur et l'aperçu pour une bonne fidélité, sans serveur.

import type { CSSProperties } from "react"

export interface LoadedSheet {
  name: string
  rows: string[][]      // contenu brut éditable ("=formule" ou valeur)
  display: string[][]   // valeur formatée (pour l'aperçu)
  styles: (CSSProperties | null)[][]
  merges: string[]      // ex. "A3:C3"
  nrows: number
  ncols: number
}

export interface LoadedWorkbook {
  wb: any // ExcelJS.Workbook (conservé pour réécriture fidèle)
  sheets: LoadedSheet[]
}

// Analyse les fusions ("A3:C3") en cases maîtresses (avec span) et cases masquées.
export function mergeInfo(merges: string[]) {
  const masters = new Map<string, { rowspan: number; colspan: number }>()
  const slaves = new Set<string>()
  const colToNum = (s: string) => {
    let n = 0
    for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
  }
  for (const m of merges || []) {
    const [a, b] = m.split(":")
    if (!b) continue
    const pa = a.match(/([A-Z]+)(\d+)/)
    const pb = b.match(/([A-Z]+)(\d+)/)
    if (!pa || !pb) continue
    const r1 = +pa[2] - 1, c1 = colToNum(pa[1])
    const r2 = +pb[2] - 1, c2 = colToNum(pb[1])
    masters.set(`${r1},${c1}`, { rowspan: r2 - r1 + 1, colspan: c2 - c1 + 1 })
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue
        slaves.add(`${r},${c}`)
      }
    }
  }
  return { masters, slaves }
}

function argbToHex(color: any): string | undefined {
  if (!color || typeof color.argb !== "string") return undefined
  const argb = color.argb
  const hex = argb.length === 8 ? argb.slice(2) : argb
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined
  return `#${hex}`
}

export function cellCss(cell: any): CSSProperties | null {
  const css: CSSProperties = {}
  const f = cell.font
  if (f) {
    if (f.bold) css.fontWeight = "bold"
    if (f.italic) css.fontStyle = "italic"
    if (f.underline) css.textDecoration = "underline"
    const col = argbToHex(f.color)
    if (col) css.color = col
    if (f.size) css.fontSize = `${f.size}pt`
    if (f.name) css.fontFamily = f.name
  }
  const fill = cell.fill
  if (fill && fill.type === "pattern" && fill.pattern === "solid") {
    const bg = argbToHex(fill.fgColor)
    if (bg) css.backgroundColor = bg
  }
  const al = cell.alignment
  if (al) {
    if (al.horizontal) css.textAlign = al.horizontal as any
    if (al.vertical) css.verticalAlign = al.vertical === "middle" ? "middle" : al.vertical
    if (al.wrapText) css.whiteSpace = "pre-wrap"
  }
  return Object.keys(css).length ? css : null
}

// Convertit une valeur de cellule ExcelJS en texte brut éditable.
function rawValue(cell: any): string {
  const v = cell.value
  if (v == null) return ""
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join("")
    if (typeof v.text === "string") return v.text
    // cell.formula résout aussi les "formules partagées" (shared formula) :
    // Google Sheets/Excel les utilisent dès qu'une formule est copiée/étirée
    // sur plusieurs cellules ; v.formula seul n'est renseigné que sur la
    // cellule maîtresse, les autres n'ont que v.sharedFormula.
    if (typeof cell.formula === "string") return "=" + cell.formula
    if (v instanceof Date) return v.toLocaleDateString("fr-FR")
    if (v.result != null) return String(v.result)
    return ""
  }
  return String(v)
}

// Texte formaté pour l'affichage (applique le format de nombre / date).
function displayValue(cell: any, SSF: any): string {
  let v = cell.value
  if (v == null) return ""
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join("")
    if (typeof v.text === "string") return v.text
    // "formula" (maîtresse) ou "sharedFormula" (cellule dépendante) : les deux
    // sont des résultats de formule, on affiche la valeur calculée.
    if ("formula" in v || "sharedFormula" in v) v = v.result
  }
  if (v == null) return ""
  if (v instanceof Date) return v.toLocaleDateString("fr-FR")
  if (typeof v === "number" && cell.numFmt) {
    try {
      const out = SSF.format(cell.numFmt, v)
      if (out != null) return String(out)
    } catch { /* format ignoré */ }
  }
  return String(v)
}

export async function loadXlsx(buf: ArrayBuffer): Promise<LoadedWorkbook> {
  const ExcelJS = (await import("exceljs")).default || (await import("exceljs"))
  const XLSX = await import("xlsx")
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)

  const sheets: LoadedSheet[] = wb.worksheets.map((ws: any) => {
    const nrows = Math.max(ws.rowCount || 0, 12)
    const ncols = Math.max(ws.columnCount || 0, 6) + 2
    const rows: string[][] = []
    const display: string[][] = []
    const styles: (CSSProperties | null)[][] = []
    for (let r = 1; r <= nrows; r++) {
      const rawRow: string[] = []
      const dispRow: string[] = []
      const styleRow: (CSSProperties | null)[] = []
      for (let c = 1; c <= ncols; c++) {
        const cell = ws.getCell(r, c)
        rawRow.push(rawValue(cell))
        dispRow.push(displayValue(cell, XLSX.SSF))
        styleRow.push(cellCss(cell))
      }
      rows.push(rawRow)
      display.push(dispRow)
      styles.push(styleRow)
    }
    const merges: string[] = Array.isArray(ws.model?.merges) ? ws.model.merges : []
    return { name: ws.name, rows, display, styles, merges, nrows, ncols }
  })

  return { wb, sheets }
}

function isNumeric(v: string): boolean {
  return v.trim() !== "" && !isNaN(Number(v)) && /^-?\d*\.?\d+$/.test(v.trim())
}

// #rrggbb -> ARGB ExcelJS (FFrrggbb)
function hexToArgb(hex?: string): string | undefined {
  if (!hex) return undefined
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  return m ? `FF${m[1].toUpperCase()}` : undefined
}

// Applique un style CSS (issu de l'éditeur) à une cellule ExcelJS.
function applyCssToCell(cell: any, css: CSSProperties) {
  const font: any = { ...(cell.font || {}) }
  if (css.fontWeight === "bold") font.bold = true
  if (css.fontStyle === "italic") font.italic = true
  if (typeof css.textDecoration === "string" && css.textDecoration.includes("underline")) font.underline = true
  const color = hexToArgb(css.color as string)
  if (color) font.color = { argb: color }
  if (css.fontFamily) font.name = String(css.fontFamily)
  if (css.fontSize) {
    const n = parseFloat(String(css.fontSize))
    if (!isNaN(n)) font.size = n
  }
  if (Object.keys(font).length) cell.font = font

  const bg = hexToArgb(css.backgroundColor as string)
  if (bg) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
  }

  const alignment: any = { ...(cell.alignment || {}) }
  if (css.textAlign) alignment.horizontal = css.textAlign as string
  if (css.verticalAlign) alignment.vertical = css.verticalAlign === "middle" ? "middle" : (css.verticalAlign as string)
  if (css.whiteSpace === "pre-wrap" || css.whiteSpace === "pre-line") alignment.wrapText = true
  if (Object.keys(alignment).length) cell.alignment = alignment
}

/**
 * Réécrit les valeurs du classeur ExcelJS d'origine (styles/fusions conservés)
 * puis renvoie le buffer .xlsx. Si `styles` est fourni, applique aussi la mise
 * en forme éditée (couleurs, gras, alignement…) aux cellules correspondantes.
 */
export async function saveXlsx(
  wb: any,
  sheets: { name: string; rows: string[][]; styles?: (CSSProperties | null)[][] }[],
): Promise<Uint8Array> {
  sheets.forEach((sheet) => {
    const ws = wb.getWorksheet(sheet.name)
    if (!ws) return
    // Ne pas écrire dans les cellules masquées par une fusion (sinon on écrase la maîtresse).
    const { slaves } = mergeInfo(Array.isArray(ws.model?.merges) ? ws.model.merges : [])
    sheet.rows.forEach((row, r) => {
      row.forEach((raw, c) => {
        if (slaves.has(`${r},${c}`)) return
        const cell = ws.getCell(r + 1, c + 1)
        const v = String(raw ?? "")
        if (v === "") {
          cell.value = null
        } else if (v.startsWith("=")) {
          cell.value = { formula: v.slice(1) } as any
        } else if (isNumeric(v)) {
          cell.value = Number(v)
        } else {
          cell.value = v
        }
        const css = sheet.styles?.[r]?.[c]
        if (css) applyCssToCell(cell, css)
      })
    })
  })
  const out = await wb.xlsx.writeBuffer()
  return new Uint8Array(out)
}
