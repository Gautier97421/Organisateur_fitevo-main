// Lecture de classeurs OpenDocument (.ods) en CONSERVANT les styles
// (couleurs de fond, police, alignement, retour à la ligne) et les fusions.
// SheetJS (édition communautaire) ne lit pas les styles ODS : on parse donc
// le content.xml / styles.xml directement, comme pour l'ODT.

import type { CSSProperties } from "react"

export interface LoadedOdsSheet {
  name: string
  rows: string[][]      // valeurs affichées
  styles: (CSSProperties | null)[][]
  merges: string[]      // ex. "A3:C3"
}

const MAX_COLS = 64
const MAX_ROWS = 500

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

function directChildren(el: Element, ...tags: string[]): Element[] {
  const out: Element[] = []
  el.childNodes.forEach((n) => {
    if (n.nodeType === 1 && tags.includes((n as Element).tagName)) out.push(n as Element)
  })
  return out
}

// Extrait le texte d'un <text:p> en gérant sauts de ligne, tabulations, espaces.
function extractText(node: Node): string {
  let s = ""
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      s += child.nodeValue || ""
    } else if (child.nodeType === 1) {
      const el = child as Element
      if (el.tagName === "text:line-break") s += "\n"
      else if (el.tagName === "text:tab") s += "\t"
      else if (el.tagName === "text:s") {
        const c = parseInt(el.getAttribute("text:c") || "1", 10) || 1
        s += " ".repeat(c)
      } else {
        s += extractText(el)
      }
    }
  })
  return s
}

function getCellText(cell: Element): string {
  const ps = directChildren(cell, "text:p")
  return ps.map((p) => extractText(p)).join("\n")
}

// Convertit un <style:style> de famille table-cell en CSS.
function parseStyleEl(styleEl: Element): CSSProperties {
  const css: CSSProperties = {}
  const cellProps = styleEl.getElementsByTagName("style:table-cell-properties")[0]
  if (cellProps) {
    const bg = cellProps.getAttribute("fo:background-color")
    if (bg && bg !== "transparent" && /^#[0-9a-fA-F]{6}$/.test(bg)) css.backgroundColor = bg
    const va = cellProps.getAttribute("style:vertical-align")
    if (va) css.verticalAlign = (va === "middle" ? "middle" : va) as any
    const wrap = cellProps.getAttribute("fo:wrap-option")
    if (wrap === "wrap") css.whiteSpace = "pre-wrap"
  }
  const textProps = styleEl.getElementsByTagName("style:text-properties")[0]
  if (textProps) {
    if (textProps.getAttribute("fo:font-weight") === "bold") css.fontWeight = "bold"
    if (textProps.getAttribute("fo:font-style") === "italic") css.fontStyle = "italic"
    const underline = textProps.getAttribute("style:text-underline-style")
    if (underline && underline !== "none") css.textDecoration = "underline"
    const color = textProps.getAttribute("fo:color")
    if (color && /^#[0-9a-fA-F]{6}$/.test(color)) css.color = color
    const size = textProps.getAttribute("fo:font-size")
    if (size) css.fontSize = size
    const fontName = textProps.getAttribute("style:font-name")
    if (fontName) css.fontFamily = fontName
  }
  const parProps = styleEl.getElementsByTagName("style:paragraph-properties")[0]
  if (parProps) {
    const ta = parProps.getAttribute("fo:text-align")
    if (ta) css.textAlign = (ta === "start" ? "left" : ta === "end" ? "right" : ta) as any
  }
  return css
}

// Construit la table des styles (avec héritage style:parent-style-name).
function buildStyleMap(docs: Document[]): Map<string, CSSProperties> {
  const raw = new Map<string, { css: CSSProperties; parent?: string }>()
  for (const doc of docs) {
    const styleEls = doc.getElementsByTagName("style:style")
    for (let i = 0; i < styleEls.length; i++) {
      const el = styleEls[i]
      const name = el.getAttribute("style:name")
      if (!name) continue
      const family = el.getAttribute("style:family")
      if (family && family !== "table-cell") continue
      raw.set(name, { css: parseStyleEl(el), parent: el.getAttribute("style:parent-style-name") || undefined })
    }
  }
  const resolved = new Map<string, CSSProperties>()
  const resolve = (name: string, seen: Set<string>): CSSProperties => {
    if (resolved.has(name)) return resolved.get(name)!
    const entry = raw.get(name)
    if (!entry) return {}
    if (seen.has(name)) return entry.css
    seen.add(name)
    const parentCss = entry.parent ? resolve(entry.parent, seen) : {}
    const merged = { ...parentCss, ...entry.css }
    resolved.set(name, merged)
    return merged
  }
  for (const name of raw.keys()) resolve(name, new Set())
  return resolved
}

function parseTable(table: Element, styleMap: Map<string, CSSProperties>): LoadedOdsSheet {
  const name = table.getAttribute("table:name") || "Feuille"
  const rows: string[][] = []
  const styles: (CSSProperties | null)[][] = []
  const merges: string[] = []
  let rowIndex = 0

  const rowEls = directChildren(table, "table:table-row")
  for (const rowEl of rowEls) {
    if (rows.length >= MAX_ROWS) break
    const rowRepeat = parseInt(rowEl.getAttribute("table:number-rows-repeated") || "1", 10) || 1

    const cellEls = directChildren(rowEl, "table:table-cell", "table:covered-table-cell")
    const rowCells: string[] = []
    const rowStyles: (CSSProperties | null)[] = []
    let colIndex = 0
    let hasContent = false

    for (const cellEl of cellEls) {
      if (colIndex >= MAX_COLS) break
      const covered = cellEl.tagName === "table:covered-table-cell"
      let repeat = parseInt(cellEl.getAttribute("table:number-columns-repeated") || "1", 10) || 1
      const text = covered ? "" : getCellText(cellEl)
      const styleName = cellEl.getAttribute("table:style-name")
      const css = (styleName && styleMap.get(styleName)) || null

      // Cellule de remplissage finale (vide, sans style, répétée massivement) → on arrête la ligne
      if (!text && !css && repeat > 100) break
      if (repeat > MAX_COLS) repeat = MAX_COLS

      // Fusion
      const colSpan = parseInt(cellEl.getAttribute("table:number-columns-spanned") || "1", 10) || 1
      const rowSpan = parseInt(cellEl.getAttribute("table:number-rows-spanned") || "1", 10) || 1
      if (!covered && (colSpan > 1 || rowSpan > 1)) {
        const a = `${colLabel(colIndex)}${rowIndex + 1}`
        const b = `${colLabel(colIndex + colSpan - 1)}${rowIndex + rowSpan}`
        merges.push(`${a}:${b}`)
      }

      for (let k = 0; k < repeat && colIndex < MAX_COLS; k++) {
        rowCells.push(text)
        rowStyles.push(css)
        if (text || css) hasContent = true
        colIndex++
      }
    }

    // Lignes vides répétées en masse → ne pas dupliquer inutilement
    const effRepeat = !hasContent && rowRepeat > 50 ? 1 : Math.min(rowRepeat, MAX_ROWS - rows.length)
    for (let k = 0; k < effRepeat && rows.length < MAX_ROWS; k++) {
      rows.push([...rowCells])
      styles.push([...rowStyles])
      rowIndex++
    }
  }

  // Retirer les lignes finales entièrement vides
  while (rows.length > 1 && rows[rows.length - 1].every((v) => !v)) {
    rows.pop()
    styles.pop()
  }

  // Largeur uniforme (au moins 6 colonnes pour un rendu agréable)
  const width = Math.max(6, ...rows.map((r) => r.length), 1)
  for (let i = 0; i < rows.length; i++) {
    while (rows[i].length < width) { rows[i].push(""); styles[i].push(null) }
  }
  if (rows.length === 0) {
    rows.push(Array.from({ length: width }, () => ""))
    styles.push(Array.from({ length: width }, () => null))
  }

  return { name, rows, styles, merges }
}

export async function loadOds(buf: ArrayBuffer): Promise<LoadedOdsSheet[]> {
  const { unzipSync, strFromU8 } = await import("fflate")
  const files = unzipSync(new Uint8Array(buf))
  const contentBytes = files["content.xml"]
  if (!contentBytes) return []
  const parser = new DOMParser()
  const contentDoc = parser.parseFromString(strFromU8(contentBytes), "application/xml")

  const docs = [contentDoc]
  if (files["styles.xml"]) {
    docs.push(parser.parseFromString(strFromU8(files["styles.xml"]), "application/xml"))
  }
  const styleMap = buildStyleMap(docs)

  const tables = contentDoc.getElementsByTagName("table:table")
  const sheets: LoadedOdsSheet[] = []
  for (let i = 0; i < tables.length; i++) {
    sheets.push(parseTable(tables[i], styleMap))
  }
  return sheets
}
