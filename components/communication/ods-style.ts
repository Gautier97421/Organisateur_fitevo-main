// Lecture de classeurs OpenDocument (.ods) en CONSERVANT les styles
// (couleurs de fond, police, alignement, retour à la ligne) et les fusions.
// SheetJS (édition communautaire) ne lit pas les styles ODS : on parse donc
// le content.xml / styles.xml directement, comme pour l'ODT.

import type { CSSProperties } from "react"
import { mergeInfo } from "./xlsx-style"

export interface LoadedOdsSheet {
  name: string
  rows: string[][]      // valeurs affichées (pour l'aperçu)
  raw: string[][]       // valeurs éditables ("=formule" ou texte) pour l'éditeur
  styles: (CSSProperties | null)[][]
  merges: string[]      // ex. "A3:C3"
}

// Convertit une formule ODF ([.A1], [.A1:.B2]) vers la notation A1 éditable.
function odsFormulaToA1(f: string): string {
  let s = f.replace(/^of:/, "").replace(/^=/, "")
  s = s.replace(/\[\.([A-Za-z]+\d+):\.([A-Za-z]+\d+)\]/g, "$1:$2")
  s = s.replace(/\[\.([A-Za-z]+\d+)\]/g, "$1")
  return "=" + s
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
  const raw: string[][] = []
  const styles: (CSSProperties | null)[][] = []
  const merges: string[] = []
  let rowIndex = 0

  const rowEls = directChildren(table, "table:table-row")
  for (const rowEl of rowEls) {
    if (rows.length >= MAX_ROWS) break
    const rowRepeat = parseInt(rowEl.getAttribute("table:number-rows-repeated") || "1", 10) || 1

    const cellEls = directChildren(rowEl, "table:table-cell", "table:covered-table-cell")
    const rowCells: string[] = []
    const rowRaw: string[] = []
    const rowStyles: (CSSProperties | null)[] = []
    let colIndex = 0
    let hasContent = false

    for (const cellEl of cellEls) {
      if (colIndex >= MAX_COLS) break
      const covered = cellEl.tagName === "table:covered-table-cell"
      let repeat = parseInt(cellEl.getAttribute("table:number-columns-repeated") || "1", 10) || 1
      const text = covered ? "" : getCellText(cellEl)
      const formula = covered ? null : cellEl.getAttribute("table:formula")
      const rawText = formula ? odsFormulaToA1(formula) : text
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
        rowRaw.push(rawText)
        rowStyles.push(css)
        if (text || css) hasContent = true
        colIndex++
      }
    }

    // Lignes vides répétées en masse → ne pas dupliquer inutilement
    const effRepeat = !hasContent && rowRepeat > 50 ? 1 : Math.min(rowRepeat, MAX_ROWS - rows.length)
    for (let k = 0; k < effRepeat && rows.length < MAX_ROWS; k++) {
      rows.push([...rowCells])
      raw.push([...rowRaw])
      styles.push([...rowStyles])
      rowIndex++
    }
  }

  // Retirer les lignes finales entièrement vides
  while (rows.length > 1 && rows[rows.length - 1].every((v) => !v)) {
    rows.pop()
    raw.pop()
    styles.pop()
  }

  // Largeur uniforme (au moins 6 colonnes pour un rendu agréable)
  const width = Math.max(6, ...rows.map((r) => r.length), 1)
  for (let i = 0; i < rows.length; i++) {
    while (rows[i].length < width) { rows[i].push(""); raw[i].push(""); styles[i].push(null) }
  }
  if (rows.length === 0) {
    rows.push(Array.from({ length: width }, () => ""))
    raw.push(Array.from({ length: width }, () => ""))
    styles.push(Array.from({ length: width }, () => null))
  }

  return { name, rows, raw, styles, merges }
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

// ── Écriture (.ods avec styles + fusions) ───────────────────────────

const escXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const escAttr = (s: string) =>
  escXml(s).replace(/"/g, "&quot;")

function isNumericVal(v: string): boolean {
  return v.trim() !== "" && !isNaN(Number(v)) && /^-?\d*\.?\d+$/.test(v.trim())
}

// Convertit une formule en notation A1 vers la notation ODF ([.A1], plages [.A1:.B2]).
function convertFormula(f: string): string {
  let body = f.slice(1)
  body = body.replace(/([A-Za-z]+\d+):([A-Za-z]+\d+)/g, "[.$1:.$2]")
  body = body.replace(/(^|[^.\[A-Za-z0-9])([A-Za-z]{1,3}\d+)(?![\]\w])/g, (_m, pre, ref) => `${pre}[.${ref}]`)
  return "of:=" + body
}

// CSS éditeur -> propriétés de style ODF (regroupées par type d'élément).
function cssToOdsProps(css: CSSProperties): { cell: string; text: string; par: string } {
  let cell = "", text = "", par = ""
  if (css.backgroundColor && /^#[0-9a-fA-F]{6}$/.test(String(css.backgroundColor)))
    cell += ` fo:background-color="${css.backgroundColor}"`
  if (css.whiteSpace === "pre-wrap" || css.whiteSpace === "pre-line")
    cell += ' fo:wrap-option="wrap"'
  if (css.verticalAlign)
    cell += ` style:vertical-align="${css.verticalAlign === "middle" ? "middle" : css.verticalAlign}"`

  if (css.fontWeight === "bold") text += ' fo:font-weight="bold"'
  if (css.fontStyle === "italic") text += ' fo:font-style="italic"'
  if (typeof css.textDecoration === "string" && css.textDecoration.includes("underline"))
    text += ' style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"'
  if (css.color && /^#[0-9a-fA-F]{6}$/.test(String(css.color))) text += ` fo:color="${css.color}"`
  if (css.fontSize) text += ` fo:font-size="${css.fontSize}"`

  if (css.textAlign) par += ` fo:text-align="${css.textAlign}"`
  return { cell, text, par }
}

interface SaveOdsSheet {
  name: string
  rows: string[][]
  styles?: (CSSProperties | null)[][]
  merges?: string[]
  display?: string[][]   // valeurs calculées (pour les formules)
}

/** Construit un fichier .ods à partir des feuilles éditées (valeurs + styles + fusions). */
export async function saveOds(sheets: SaveOdsSheet[]): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("fflate")

  // Dédoublonnage des styles
  const styleDefs: string[] = []
  const styleKeyToName = new Map<string, string>()
  const styleNameFor = (css: CSSProperties | null | undefined): string => {
    if (!css || Object.keys(css).length === 0) return ""
    const key = JSON.stringify(css)
    const existing = styleKeyToName.get(key)
    if (existing) return existing
    const name = `ce${styleKeyToName.size + 1}`
    styleKeyToName.set(key, name)
    const { cell, text, par } = cssToOdsProps(css)
    styleDefs.push(
      `<style:style style:name="${name}" style:family="table-cell">` +
        (cell ? `<style:table-cell-properties${cell}/>` : "") +
        (par ? `<style:paragraph-properties${par}/>` : "") +
        (text ? `<style:text-properties${text}/>` : "") +
        "</style:style>",
    )
    return name
  }

  const tablesXml = sheets
    .map((sheet) => {
      const mi = mergeInfo(sheet.merges || [])
      const ncols = Math.max(1, ...sheet.rows.map((r) => r.length))
      const rowsXml = sheet.rows
        .map((row, r) => {
          let cells = ""
          for (let c = 0; c < ncols; c++) {
            const key = `${r},${c}`
            if (mi.slaves.has(key)) { cells += "<table:covered-table-cell/>"; continue }
            const raw = row[c] ?? ""
            const css = sheet.styles?.[r]?.[c]
            const styleName = styleNameFor(css)
            const styleAttr = styleName ? ` table:style-name="${styleName}"` : ""
            const span = mi.masters.get(key)
            const spanAttr = span
              ? ` table:number-columns-spanned="${span.colspan}" table:number-rows-spanned="${span.rowspan}"`
              : ""

            if (raw === "") {
              cells += `<table:table-cell${styleAttr}${spanAttr}/>`
            } else if (raw.startsWith("=")) {
              const disp = sheet.display?.[r]?.[c] ?? ""
              const valAttr = isNumericVal(disp) ? ` office:value-type="float" office:value="${escAttr(disp)}"` : ' office:value-type="string"'
              cells += `<table:table-cell${styleAttr}${spanAttr} table:formula="${escAttr(convertFormula(raw))}"${valAttr}><text:p>${escXml(disp)}</text:p></table:table-cell>`
            } else if (isNumericVal(raw)) {
              cells += `<table:table-cell${styleAttr}${spanAttr} office:value-type="float" office:value="${escAttr(raw)}"><text:p>${escXml(raw)}</text:p></table:table-cell>`
            } else {
              const inner = escXml(raw).split("\n").join("<text:line-break/>")
              cells += `<table:table-cell${styleAttr}${spanAttr} office:value-type="string"><text:p>${inner}</text:p></table:table-cell>`
            }
          }
          return `<table:table-row>${cells}</table:table-row>`
        })
        .join("")
      return (
        `<table:table table:name="${escAttr(sheet.name || "Feuille")}">` +
        `<table:table-column table:number-columns-repeated="${ncols}"/>` +
        rowsXml +
        "</table:table>"
      )
    })
    .join("")

  const NS =
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
    'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
    'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
    'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"'

  const contentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<office:document-content ${NS} office:version="1.2">` +
    `<office:automatic-styles>${styleDefs.join("")}</office:automatic-styles>` +
    "<office:body><office:spreadsheet>" +
    tablesXml +
    "</office:spreadsheet></office:body></office:document-content>"

  const manifestXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
    '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>' +
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
    "</manifest:manifest>"

  return zipSync({
    mimetype: [strToU8("application/vnd.oasis.opendocument.spreadsheet"), { level: 0 }],
    "content.xml": strToU8(contentXml),
    "META-INF/manifest.xml": strToU8(manifestXml),
  })
}
