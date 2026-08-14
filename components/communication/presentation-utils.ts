// Lecture de présentations PowerPoint (.pptx) et OpenDocument (.odp) côté client,
// pour l'aperçu. Les deux formats sont des archives ZIP de XML : on les décompresse
// avec fflate (déjà utilisé pour l'ODT/ODS) et on convertit chaque diapositive en
// une liste de boîtes positionnées, que le composant d'aperçu pose en absolu.
//
// L'objectif est un aperçu fidèle « au premier coup d'œil » (texte, position,
// couleurs, images, tableaux), pas un rendu parfait : les animations, les dégradés,
// les formes complexes (flèches, connecteurs) et les effets ne sont pas rendus.

import type { CSSProperties } from "react"

export interface SlideRun {
  text: string
  style: CSSProperties
}

export interface SlidePara {
  runs: SlideRun[]
  align?: CSSProperties["textAlign"]
  bullet?: string | null
  level: number
}

export interface SlideCell {
  paras: SlidePara[]
  style?: CSSProperties
}

export interface SlideBox {
  kind: "text" | "image" | "table"
  x: number
  y: number
  w: number
  h: number
  rot?: number
  paras?: SlidePara[]
  src?: string
  rows?: SlideCell[][]
  colWidths?: number[]
  boxStyle?: CSSProperties
  vAlign?: "flex-start" | "center" | "flex-end"
}

export interface LoadedSlide {
  boxes: SlideBox[]
  background?: string
}

export interface LoadedPresentation {
  /** Dimensions de la diapositive en pixels (base du rendu, mis à l'échelle à l'affichage). */
  width: number
  height: number
  slides: LoadedSlide[]
}

// ── Helpers XML ───────────────────────────────────────────────────

function kids(el: Element | null | undefined, tag: string): Element[] {
  if (!el) return []
  const out: Element[] = []
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i]
    if (n.nodeType === 1 && (n as Element).tagName === tag) out.push(n as Element)
  }
  return out
}

function kid(el: Element | null | undefined, tag: string): Element | null {
  return kids(el, tag)[0] || null
}

/** Premier descendant portant ce nom qualifié (recherche en profondeur). */
function desc(el: Element | Document | null | undefined, tag: string): Element | null {
  if (!el) return null
  const list = el.getElementsByTagName(tag)
  return list.length ? list[0] : null
}

function num(v: string | null | undefined, fallback = 0): number {
  if (v == null || v === "") return fallback
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

// ── Couleurs ──────────────────────────────────────────────────────

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")
}

/**
 * Applique les modificateurs de luminosité OOXML (`lumMod`/`lumOff`), très utilisés
 * pour les déclinaisons claires/foncées d'une couleur de thème.
 */
function applyLum(hex: string, lumMod: number | null, lumOff: number | null): string {
  if (lumMod == null && lumOff == null) return hex
  const [r, g, b] = hexToRgb(hex)
  const mod = lumMod == null ? 1 : lumMod
  const off = lumOff == null ? 0 : lumOff
  const f = (v: number) => (v / 255) * mod + off
  return rgbToHex(f(r) * 255, f(g) * 255, f(b) * 255)
}

const PRESET_COLORS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", gray: "#808080", grey: "#808080", darkGray: "#a9a9a9", lightGray: "#d3d3d3",
  orange: "#ffa500", purple: "#800080",
}

/**
 * Résout un conteneur de couleur OOXML (`a:solidFill`, `a:fgClr`…) en couleur CSS.
 * Gère les couleurs directes, les couleurs de thème (via la table de correspondance
 * du masque) et la transparence.
 */
function ooxmlColor(
  container: Element | null,
  theme: Record<string, string>,
  clrMap: Record<string, string>,
): string | undefined {
  if (!container) return undefined

  let base: string | undefined
  let node: Element | null = null

  const srgb = kid(container, "a:srgbClr")
  const scheme = kid(container, "a:schemeClr")
  const sys = kid(container, "a:sysClr")
  const prst = kid(container, "a:prstClr")

  if (srgb) {
    node = srgb
    base = "#" + (srgb.getAttribute("val") || "000000")
  } else if (scheme) {
    node = scheme
    const raw = scheme.getAttribute("val") || ""
    const mapped = clrMap[raw] || raw
    base = theme[mapped] || theme[raw]
  } else if (sys) {
    node = sys
    base = "#" + (sys.getAttribute("lastClr") || "000000")
  } else if (prst) {
    node = prst
    base = PRESET_COLORS[prst.getAttribute("val") || ""] || undefined
  }

  if (!base) return undefined

  const lumMod = kid(node, "a:lumMod")
  const lumOff = kid(node, "a:lumOff")
  base = applyLum(
    base,
    lumMod ? num(lumMod.getAttribute("val")) / 100000 : null,
    lumOff ? num(lumOff.getAttribute("val")) / 100000 : null,
  )

  const alphaEl = kid(node, "a:alpha")
  if (alphaEl) {
    const a = num(alphaEl.getAttribute("val"), 100000) / 100000
    const [r, g, b] = hexToRgb(base)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  return base
}

// ── PPTX ──────────────────────────────────────────────────────────

const EMU_PER_PX = 9525

/** Correspondance nom de couleur de thème par défaut (masque sans `p:clrMap`). */
const DEFAULT_CLR_MAP: Record<string, string> = {
  bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2",
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml", tif: "image/tiff", tiff: "image/tiff",
}

function bytesToDataUri(bytes: Uint8Array, mime: string): string {
  let binary = ""
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[])
  }
  return `data:${mime};base64,${btoa(binary)}`
}

/** Résout un chemin relatif de relation ZIP (« ../media/image1.png ») en chemin absolu dans l'archive. */
function resolveZipPath(basePath: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1)
  const baseDir = basePath.split("/").slice(0, -1)
  const parts = target.split("/")
  for (const p of parts) {
    if (p === "." || p === "") continue
    if (p === "..") baseDir.pop()
    else baseDir.push(p)
  }
  return baseDir.join("/")
}

type XmlLoader = (path: string) => Document | null

/** Table rId -> chemin absolu dans l'archive, pour un fichier donné. */
function loadRels(loadXml: XmlLoader, path: string): Record<string, string> {
  const dir = path.split("/").slice(0, -1).join("/")
  const name = path.split("/").pop()
  const relDoc = loadXml(`${dir}/_rels/${name}.rels`)
  const out: Record<string, string> = {}
  if (!relDoc) return out
  const rels = relDoc.getElementsByTagName("Relationship")
  for (let i = 0; i < rels.length; i++) {
    const id = rels[i].getAttribute("Id")
    const target = rels[i].getAttribute("Target")
    if (!id || !target) continue
    if (rels[i].getAttribute("TargetMode") === "External") continue
    out[id] = resolveZipPath(path, target)
  }
  return out
}

interface Xfrm { x: number; y: number; w: number; h: number; rot: number }

function readXfrm(spPr: Element | null, tag = "a:xfrm"): Xfrm | null {
  const xfrm = kid(spPr, tag)
  if (!xfrm) return null
  const off = kid(xfrm, "a:off")
  const ext = kid(xfrm, "a:ext")
  if (!off || !ext) return null
  return {
    x: num(off.getAttribute("x")) / EMU_PER_PX,
    y: num(off.getAttribute("y")) / EMU_PER_PX,
    w: num(ext.getAttribute("cx")) / EMU_PER_PX,
    h: num(ext.getAttribute("cy")) / EMU_PER_PX,
    rot: num(xfrm.getAttribute("rot")) / 60000,
  }
}

/** Contexte de transformation, alimenté par les groupes (`p:grpSp`). */
interface Ctx { dx: number; dy: number; sx: number; sy: number }
const ROOT_CTX: Ctx = { dx: 0, dy: 0, sx: 1, sy: 1 }

function applyCtx(f: Xfrm, ctx: Ctx): Xfrm {
  return {
    x: ctx.dx + f.x * ctx.sx,
    y: ctx.dy + f.y * ctx.sy,
    w: f.w * ctx.sx,
    h: f.h * ctx.sy,
    rot: f.rot,
  }
}

/** Type de réservation (placeholder) d'une forme : titre, corps, numéro de page… */
function phInfo(sp: Element): { type: string; idx: string } | null {
  const ph = desc(kid(kid(sp, "p:nvSpPr"), "p:nvPr"), "p:ph")
  if (!ph) return null
  return { type: ph.getAttribute("type") || "body", idx: ph.getAttribute("idx") || "" }
}

/** Géométrie des placeholders d'une mise en page / d'un masque, pour l'héritage. */
function collectPlaceholders(spTree: Element | null): Map<string, Xfrm> {
  const map = new Map<string, Xfrm>()
  if (!spTree) return map
  for (const sp of kids(spTree, "p:sp")) {
    const ph = phInfo(sp)
    if (!ph) continue
    const xfrm = readXfrm(kid(sp, "p:spPr"))
    if (!xfrm) continue
    map.set(`${ph.type}:${ph.idx}`, xfrm)
    if (!map.has(`:${ph.idx}`)) map.set(`:${ph.idx}`, xfrm)
    if (!map.has(`${ph.type}:`)) map.set(`${ph.type}:`, xfrm)
  }
  return map
}

const TITLE_TYPES = new Set(["title", "ctrTitle"])

function lookupPlaceholder(maps: Map<string, Xfrm>[], ph: { type: string; idx: string }): Xfrm | null {
  const keys = [`${ph.type}:${ph.idx}`, `${ph.type}:`, `:${ph.idx}`]
  // Un titre centré et un titre classique se substituent l'un à l'autre.
  if (TITLE_TYPES.has(ph.type)) {
    for (const t of TITLE_TYPES) keys.push(`${t}:`)
  }
  for (const map of maps) {
    for (const k of keys) {
      const hit = map.get(k)
      if (hit) return hit
    }
  }
  return null
}

/** Taille de police par défaut (pt) quand le run n'en précise pas. */
function defaultFontSize(phType: string | null): number {
  if (phType && TITLE_TYPES.has(phType)) return 44
  if (phType === "subTitle") return 32
  if (phType === "sldNum" || phType === "ftr" || phType === "dt") return 12
  return 18
}

function parseTxBody(
  txBody: Element | null,
  opts: { theme: Record<string, string>; clrMap: Record<string, string>; phType: string | null },
): { paras: SlidePara[]; vAlign: SlideBox["vAlign"] } {
  const paras: SlidePara[] = []
  if (!txBody) return { paras, vAlign: "flex-start" }

  const bodyPr = kid(txBody, "a:bodyPr")
  const anchor = bodyPr?.getAttribute("anchor")
  const vAlign: SlideBox["vAlign"] = anchor === "ctr" ? "center" : anchor === "b" ? "flex-end" : "flex-start"

  // Un corps de texte (hors titre) porte des puces par défaut, héritées du masque :
  // on les reproduit sauf mention explicite `a:buNone`.
  const bulletsByDefault = !!opts.phType && !TITLE_TYPES.has(opts.phType) && opts.phType !== "subTitle"
  const autoNumCounters: Record<number, number> = {}

  for (const p of kids(txBody, "a:p")) {
    const pPr = kid(p, "a:pPr")
    const level = Math.max(0, Math.min(8, parseInt(pPr?.getAttribute("lvl") || "0", 10) || 0))
    const algn = pPr?.getAttribute("algn")
    const align: CSSProperties["textAlign"] =
      algn === "ctr" ? "center" : algn === "r" ? "right" : algn === "just" ? "justify" : "left"

    let bullet: string | null = null
    if (pPr) {
      if (kid(pPr, "a:buNone")) bullet = null
      else if (kid(pPr, "a:buChar")) bullet = kid(pPr, "a:buChar")!.getAttribute("char") || "•"
      else if (kid(pPr, "a:buAutoNum")) {
        autoNumCounters[level] = (autoNumCounters[level] || 0) + 1
        bullet = `${autoNumCounters[level]}.`
      } else if (bulletsByDefault) bullet = level > 0 ? "–" : "•"
    } else if (bulletsByDefault) {
      bullet = level > 0 ? "–" : "•"
    }

    const runs: SlideRun[] = []
    for (let i = 0; i < p.childNodes.length; i++) {
      const node = p.childNodes[i]
      if (node.nodeType !== 1) continue
      const el = node as Element
      if (el.tagName === "a:br") {
        runs.push({ text: "\n", style: {} })
        continue
      }
      if (el.tagName !== "a:r" && el.tagName !== "a:fld") continue
      const text = kid(el, "a:t")?.textContent || ""
      if (!text) continue
      const rPr = kid(el, "a:rPr") || kid(el, "a:defRPr")
      const style: CSSProperties = {}
      const sz = rPr ? num(rPr.getAttribute("sz")) : 0
      style.fontSize = `${(sz ? sz / 100 : defaultFontSize(opts.phType))}pt`
      if (rPr?.getAttribute("b") === "1") style.fontWeight = 700
      if (rPr?.getAttribute("i") === "1") style.fontStyle = "italic"
      const u = rPr?.getAttribute("u")
      if (u && u !== "none") style.textDecoration = "underline"
      const color = ooxmlColor(kid(rPr, "a:solidFill"), opts.theme, opts.clrMap)
      if (color) style.color = color
      const latin = kid(rPr, "a:latin")?.getAttribute("typeface")
      if (latin && !latin.startsWith("+")) style.fontFamily = `"${latin}", sans-serif`
      runs.push({ text, style })
    }

    // Les paragraphes vides servent d'espacement : on les garde s'ils sont entourés de texte.
    if (runs.length === 0 && paras.length === 0) continue
    paras.push({ runs, align, bullet: runs.length ? bullet : null, level })
  }

  while (paras.length && paras[paras.length - 1].runs.length === 0) paras.pop()
  return { paras, vAlign }
}

function pptxTable(
  graphicFrame: Element,
  frame: Xfrm,
  opts: { theme: Record<string, string>; clrMap: Record<string, string> },
): SlideBox | null {
  const tbl = desc(graphicFrame, "a:tbl")
  if (!tbl) return null
  const grid = kid(tbl, "a:tblGrid")
  const colWidths = kids(grid, "a:gridCol").map((c) => num(c.getAttribute("w")) / EMU_PER_PX)
  const rows: SlideCell[][] = []
  for (const tr of kids(tbl, "a:tr")) {
    const cells: SlideCell[] = []
    for (const tc of kids(tr, "a:tc")) {
      const { paras } = parseTxBody(kid(tc, "a:txBody"), { ...opts, phType: null })
      const fill = ooxmlColor(kid(kid(tc, "a:tcPr"), "a:solidFill"), opts.theme, opts.clrMap)
      cells.push({ paras, style: fill ? { backgroundColor: fill } : undefined })
    }
    if (cells.length) rows.push(cells)
  }
  if (!rows.length) return null
  return { kind: "table", x: frame.x, y: frame.y, w: frame.w, h: frame.h, rows, colWidths }
}

/**
 * Convertit un .pptx en diapositives affichables.
 */
export async function loadPptx(buf: ArrayBuffer): Promise<LoadedPresentation> {
  const { unzipSync, strFromU8 } = await import("fflate")
  const files = unzipSync(new Uint8Array(buf))

  const cache = new Map<string, Document | null>()
  const loadXml: XmlLoader = (path) => {
    if (cache.has(path)) return cache.get(path)!
    const bytes = files[path]
    const doc = bytes ? new DOMParser().parseFromString(strFromU8(bytes), "application/xml") : null
    cache.set(path, doc)
    return doc
  }

  const presDoc = loadXml("ppt/presentation.xml")
  if (!presDoc) throw new Error("Présentation illisible")

  const sldSz = desc(presDoc, "p:sldSz")
  const width = num(sldSz?.getAttribute("cx"), 12192000) / EMU_PER_PX
  const height = num(sldSz?.getAttribute("cy"), 6858000) / EMU_PER_PX

  // Ordre des diapositives : p:sldIdLst + relations de presentation.xml.
  const presRels = loadRels(loadXml, "ppt/presentation.xml")
  let slidePaths = kids(desc(presDoc, "p:sldIdLst"), "p:sldId")
    .map((el) => presRels[el.getAttribute("r:id") || ""])
    .filter(Boolean)
  if (!slidePaths.length) {
    slidePaths = Object.keys(files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => num(a.match(/(\d+)\.xml$/)?.[1]) - num(b.match(/(\d+)\.xml$/)?.[1]))
  }

  const slides: LoadedSlide[] = []

  for (const slidePath of slidePaths) {
    const slideDoc = loadXml(slidePath)
    if (!slideDoc) continue
    const slideRels = loadRels(loadXml, slidePath)

    // Mise en page -> masque -> thème.
    const layoutPath = Object.values(slideRels).find((p) => p.includes("/slideLayouts/"))
    const layoutDoc = layoutPath ? loadXml(layoutPath) : null
    const layoutRels = layoutPath ? loadRels(loadXml, layoutPath) : {}
    const masterPath = Object.values(layoutRels).find((p) => p.includes("/slideMasters/"))
    const masterDoc = masterPath ? loadXml(masterPath) : null
    const masterRels = masterPath ? loadRels(loadXml, masterPath) : {}
    const themePath = Object.values(masterRels).find((p) => p.includes("/theme/"))
    const themeDoc = themePath ? loadXml(themePath) : null

    const theme: Record<string, string> = {}
    const clrScheme = desc(themeDoc, "a:clrScheme")
    if (clrScheme) {
      for (let i = 0; i < clrScheme.childNodes.length; i++) {
        const node = clrScheme.childNodes[i]
        if (node.nodeType !== 1) continue
        const el = node as Element
        const name = el.tagName.replace(/^a:/, "")
        const hex = ooxmlColor(el, {}, {})
        if (hex) theme[name] = hex
      }
    }

    const clrMapEl = desc(masterDoc, "p:clrMap")
    const clrMap: Record<string, string> = { ...DEFAULT_CLR_MAP }
    if (clrMapEl) {
      for (const key of ["bg1", "tx1", "bg2", "tx2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]) {
        const v = clrMapEl.getAttribute(key)
        if (v) clrMap[key] = v
      }
    }
    const opts = { theme, clrMap }

    const layoutPh = collectPlaceholders(desc(layoutDoc, "p:spTree"))
    const masterPh = collectPlaceholders(desc(masterDoc, "p:spTree"))

    // Fond : diapositive, sinon mise en page, sinon masque.
    let background: string | undefined
    for (const doc of [slideDoc, layoutDoc, masterDoc]) {
      const bg = desc(doc, "p:bg")
      if (!bg) continue
      const fill = kid(desc(bg, "p:bgPr"), "a:solidFill") || kid(bg, "a:solidFill")
      const color = ooxmlColor(fill, theme, clrMap)
      if (color) { background = color; break }
    }

    const boxes: SlideBox[] = []

    const walk = (tree: Element | null, ctx: Ctx) => {
      if (!tree) return
      for (let i = 0; i < tree.childNodes.length; i++) {
        const node = tree.childNodes[i]
        if (node.nodeType !== 1) continue
        const el = node as Element

        if (el.tagName === "p:grpSp") {
          const grpXfrm = kid(kid(el, "p:grpSpPr"), "a:xfrm")
          const outer = readXfrm(kid(el, "p:grpSpPr"))
          const chOff = kid(grpXfrm, "a:chOff")
          const chExt = kid(grpXfrm, "a:chExt")
          let childCtx = ctx
          if (outer && chOff && chExt) {
            const cw = num(chExt.getAttribute("cx")) / EMU_PER_PX
            const ch = num(chExt.getAttribute("cy")) / EMU_PER_PX
            const ox = num(chOff.getAttribute("x")) / EMU_PER_PX
            const oy = num(chOff.getAttribute("y")) / EMU_PER_PX
            const sx = cw ? (outer.w / cw) * ctx.sx : ctx.sx
            const sy = ch ? (outer.h / ch) * ctx.sy : ctx.sy
            childCtx = {
              dx: ctx.dx + outer.x * ctx.sx - ox * sx,
              dy: ctx.dy + outer.y * ctx.sy - oy * sy,
              sx,
              sy,
            }
          }
          walk(el, childCtx)
          continue
        }

        if (el.tagName === "p:sp") {
          const spPr = kid(el, "p:spPr")
          const ph = phInfo(el)
          let xfrm = readXfrm(spPr)
          if (!xfrm && ph) xfrm = lookupPlaceholder([layoutPh, masterPh], ph)
          if (!xfrm) continue
          const frame = applyCtx(xfrm, ctx)

          const { paras, vAlign } = parseTxBody(kid(el, "p:txBody"), { ...opts, phType: ph?.type ?? null })
          const boxStyle: CSSProperties = {}
          const fill = ooxmlColor(kid(spPr, "a:solidFill"), theme, clrMap)
          if (fill) boxStyle.backgroundColor = fill
          const lnColor = ooxmlColor(kid(kid(spPr, "a:ln"), "a:solidFill"), theme, clrMap)
          if (lnColor) {
            const wEmu = num(kid(spPr, "a:ln")?.getAttribute("w"), 12700)
            boxStyle.border = `${Math.max(1, wEmu / EMU_PER_PX)}px solid ${lnColor}`
          }
          const prst = kid(spPr, "a:prstGeom")?.getAttribute("prst")
          if (prst === "ellipse") boxStyle.borderRadius = "50%"
          else if (prst === "roundRect") boxStyle.borderRadius = "12px"

          // Une forme sans texte ni remplissage ni contour n'apporte rien à l'aperçu.
          if (!paras.length && !fill && !lnColor) continue

          boxes.push({
            kind: "text",
            x: frame.x, y: frame.y, w: frame.w, h: frame.h,
            rot: frame.rot || undefined,
            paras,
            boxStyle: Object.keys(boxStyle).length ? boxStyle : undefined,
            vAlign,
          })
          continue
        }

        if (el.tagName === "p:pic") {
          const xfrm = readXfrm(kid(el, "p:spPr"))
          if (!xfrm) continue
          const frame = applyCtx(xfrm, ctx)
          const embed = desc(kid(el, "p:blipFill"), "a:blip")?.getAttribute("r:embed")
          const mediaPath = embed ? slideRels[embed] : undefined
          const bytes = mediaPath ? files[mediaPath] : undefined
          if (!bytes) continue
          const ext = (mediaPath!.split(".").pop() || "").toLowerCase()
          const mime = IMAGE_MIME[ext]
          if (!mime) continue // emf/wmf : non affichables par le navigateur
          boxes.push({
            kind: "image",
            x: frame.x, y: frame.y, w: frame.w, h: frame.h,
            rot: frame.rot || undefined,
            src: bytesToDataUri(bytes, mime),
          })
          continue
        }

        if (el.tagName === "p:graphicFrame") {
          const gfXfrm = readXfrmFromGraphicFrame(el)
          if (!gfXfrm) continue
          const frame = applyCtx(gfXfrm, ctx)
          const table = pptxTable(el, frame, opts)
          if (table) boxes.push(table)
        }
      }
    }

    walk(desc(slideDoc, "p:spTree"), ROOT_CTX)
    slides.push({ boxes, background })
  }

  return { width, height, slides }
}

/** `p:graphicFrame` porte sa géométrie dans `p:xfrm` (et non `a:xfrm`). */
function readXfrmFromGraphicFrame(el: Element): Xfrm | null {
  const xfrm = kid(el, "p:xfrm")
  if (!xfrm) return null
  const off = kid(xfrm, "a:off")
  const ext = kid(xfrm, "a:ext")
  if (!off || !ext) return null
  return {
    x: num(off.getAttribute("x")) / EMU_PER_PX,
    y: num(off.getAttribute("y")) / EMU_PER_PX,
    w: num(ext.getAttribute("cx")) / EMU_PER_PX,
    h: num(ext.getAttribute("cy")) / EMU_PER_PX,
    rot: num(xfrm.getAttribute("rot")) / 60000,
  }
}

// ── ODP (OpenDocument Presentation) ───────────────────────────────

/** Convertit une longueur ODF (« 2.5cm », « 12pt »…) en pixels. */
function odfLength(value: string | null | undefined): number {
  if (!value) return 0
  const m = /^(-?[\d.]+)\s*(cm|mm|in|pt|pc|px|em)?$/.exec(value.trim())
  if (!m) return 0
  const n = parseFloat(m[1])
  switch (m[2]) {
    case "cm": return (n / 2.54) * 96
    case "mm": return (n / 25.4) * 96
    case "in": return n * 96
    case "pt": return (n / 72) * 96
    case "pc": return (n / 6) * 96
    case "em": return n * 16
    default: return n
  }
}

interface OdfStyle {
  parent?: string
  text: CSSProperties
  para: CSSProperties
  graphic: CSSProperties
  vAlign?: SlideBox["vAlign"]
  fillNone?: boolean
}

function collectOdfStyles(docs: (Document | null)[]): Map<string, OdfStyle> {
  const map = new Map<string, OdfStyle>()
  for (const doc of docs) {
    if (!doc) continue
    const styleEls = doc.getElementsByTagName("style:style")
    for (let i = 0; i < styleEls.length; i++) {
      const el = styleEls[i]
      const name = el.getAttribute("style:name")
      if (!name) continue
      const style: OdfStyle = { text: {}, para: {}, graphic: {} }
      const parent = el.getAttribute("style:parent-style-name")
      if (parent) style.parent = parent

      const textProps = kid(el, "style:text-properties")
      if (textProps) {
        const size = textProps.getAttribute("fo:font-size")
        if (size) style.text.fontSize = size.endsWith("%") ? undefined : `${odfLength(size)}px`
        const weight = textProps.getAttribute("fo:font-weight")
        if (weight) style.text.fontWeight = weight === "bold" ? 700 : 400
        const italic = textProps.getAttribute("fo:font-style")
        if (italic === "italic") style.text.fontStyle = "italic"
        const color = textProps.getAttribute("fo:color")
        if (color) style.text.color = color
        const underline = textProps.getAttribute("style:text-underline-style")
        if (underline && underline !== "none") style.text.textDecoration = "underline"
        const family = textProps.getAttribute("style:font-name") || textProps.getAttribute("fo:font-family")
        if (family) style.text.fontFamily = `"${family.replace(/["']/g, "")}", sans-serif`
      }

      const paraProps = kid(el, "style:paragraph-properties")
      if (paraProps) {
        const align = paraProps.getAttribute("fo:text-align")
        if (align) {
          style.para.textAlign = align === "end" ? "right" : align === "start" ? "left" : (align as CSSProperties["textAlign"])
        }
      }

      const gProps = kid(el, "style:graphic-properties")
      if (gProps) {
        const fill = gProps.getAttribute("draw:fill")
        const fillColor = gProps.getAttribute("draw:fill-color")
        if (fill === "none") style.fillNone = true
        else if (fillColor) style.graphic.backgroundColor = fillColor
        const stroke = gProps.getAttribute("draw:stroke")
        const strokeColor = gProps.getAttribute("svg:stroke-color")
        if (stroke && stroke !== "none" && strokeColor) style.graphic.border = `1px solid ${strokeColor}`
        const anchor = gProps.getAttribute("draw:textarea-vertical-align")
        if (anchor === "middle") style.vAlign = "center"
        else if (anchor === "bottom") style.vAlign = "flex-end"
      }

      map.set(name, style)
    }
  }
  return map
}

/** Fusionne un style avec ses parents (le style enfant l'emporte). */
function resolveOdfStyle(name: string | null | undefined, styles: Map<string, OdfStyle>, seen = new Set<string>()): OdfStyle {
  const empty: OdfStyle = { text: {}, para: {}, graphic: {} }
  if (!name || seen.has(name)) return empty
  seen.add(name)
  const own = styles.get(name)
  if (!own) return empty
  const parent = resolveOdfStyle(own.parent, styles, seen)
  return {
    text: { ...parent.text, ...own.text },
    para: { ...parent.para, ...own.para },
    graphic: { ...parent.graphic, ...own.graphic },
    vAlign: own.vAlign ?? parent.vAlign,
    fillNone: own.fillNone ?? parent.fillNone,
  }
}

/** Texte d'un `text:p` / `text:h` découpé en runs stylés (`text:span`). */
function odfRuns(node: Element, styles: Map<string, OdfStyle>, inherited: CSSProperties): SlideRun[] {
  const runs: SlideRun[] = []
  const walk = (el: Element, style: CSSProperties) => {
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i]
      if (child.nodeType === 3) {
        const text = child.nodeValue || ""
        if (text) runs.push({ text, style })
        continue
      }
      if (child.nodeType !== 1) continue
      const c = child as Element
      if (c.tagName === "text:line-break") { runs.push({ text: "\n", style }); continue }
      if (c.tagName === "text:tab") { runs.push({ text: "\u00a0\u00a0", style }); continue }
      if (c.tagName === "text:s") {
        const n = parseInt(c.getAttribute("text:c") || "1", 10) || 1
        runs.push({ text: "\u00a0".repeat(n), style })
        continue
      }
      if (c.tagName === "text:span") {
        const s = resolveOdfStyle(c.getAttribute("text:style-name"), styles)
        walk(c, { ...style, ...s.text })
        continue
      }
      walk(c, style)
    }
  }
  walk(node, inherited)
  return runs
}

/**
 * Convertit un .odp en diapositives affichables.
 */
export async function loadOdp(buf: ArrayBuffer): Promise<LoadedPresentation> {
  const { unzipSync, strFromU8 } = await import("fflate")
  const files = unzipSync(new Uint8Array(buf))

  const parse = (path: string): Document | null => {
    const bytes = files[path]
    return bytes ? new DOMParser().parseFromString(strFromU8(bytes), "application/xml") : null
  }

  const contentDoc = parse("content.xml")
  if (!contentDoc) throw new Error("Présentation illisible")
  const stylesDoc = parse("styles.xml")

  const styles = collectOdfStyles([contentDoc, stylesDoc])

  // Dimensions : première mise en page de page trouvée, sinon 16/9 par défaut.
  let width = 0
  let height = 0
  for (const doc of [stylesDoc, contentDoc]) {
    const props = desc(doc, "style:page-layout-properties")
    if (!props) continue
    width = odfLength(props.getAttribute("fo:page-width"))
    height = odfLength(props.getAttribute("fo:page-height"))
    if (width && height) break
  }
  if (!width || !height) { width = 1058; height = 595 }

  // Fond des pages maîtresses (référencé par draw:master-page-name).
  const masterBg = new Map<string, string>()
  const masterPages = stylesDoc?.getElementsByTagName("style:master-page")
  if (masterPages) {
    for (let i = 0; i < masterPages.length; i++) {
      const mp = masterPages[i]
      const name = mp.getAttribute("style:name")
      const drawStyle = resolveOdfStyle(mp.getAttribute("draw:style-name"), styles)
      const bg = drawStyle.graphic.backgroundColor
      if (name && typeof bg === "string" && !drawStyle.fillNone) masterBg.set(name, bg)
    }
  }

  const slides: LoadedSlide[] = []
  const pages = contentDoc.getElementsByTagName("draw:page")

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const boxes: SlideBox[] = []
    const background = masterBg.get(page.getAttribute("draw:master-page-name") || "")

    const pushShape = (el: Element) => {
      const x = odfLength(el.getAttribute("svg:x"))
      const y = odfLength(el.getAttribute("svg:y"))
      const w = odfLength(el.getAttribute("svg:width"))
      const h = odfLength(el.getAttribute("svg:height"))
      const gStyle = resolveOdfStyle(el.getAttribute("draw:style-name"), styles)

      // Image (draw:image dans un draw:frame)
      const image = kid(el, "draw:image")
      const href = image?.getAttribute("xlink:href")
      if (image && href) {
        const path = href.replace(/^\.\//, "")
        const bytes = files[path]
        const ext = (path.split(".").pop() || "").toLowerCase()
        const mime = IMAGE_MIME[ext]
        if (bytes && mime) {
          boxes.push({ kind: "image", x, y, w, h, src: bytesToDataUri(bytes, mime) })
          return
        }
      }

      // Texte : draw:text-box (frame) ou texte directement porté par la forme.
      const textHost = kid(el, "draw:text-box") || el
      const paras: SlidePara[] = []
      for (let j = 0; j < textHost.childNodes.length; j++) {
        const node = textHost.childNodes[j]
        if (node.nodeType !== 1) continue
        const c = node as Element
        if (c.tagName !== "text:p" && c.tagName !== "text:h" && c.tagName !== "text:list") continue

        const collectParagraph = (pEl: Element, level: number) => {
          const pStyle = resolveOdfStyle(pEl.getAttribute("text:style-name"), styles)
          const runs = odfRuns(pEl, styles, { ...gStyle.text, ...pStyle.text })
          if (runs.length === 0 && paras.length === 0) return
          paras.push({
            runs,
            align: (pStyle.para.textAlign || gStyle.para.textAlign) as CSSProperties["textAlign"],
            bullet: level > 0 && runs.length ? (level > 1 ? "–" : "•") : null,
            level: Math.max(0, level - 1),
          })
        }

        const walkList = (listEl: Element, level: number) => {
          for (const item of kids(listEl, "text:list-item")) {
            for (let k = 0; k < item.childNodes.length; k++) {
              const inner = item.childNodes[k]
              if (inner.nodeType !== 1) continue
              const ie = inner as Element
              if (ie.tagName === "text:list") walkList(ie, level + 1)
              else if (ie.tagName === "text:p" || ie.tagName === "text:h") collectParagraph(ie, level)
            }
          }
        }

        if (c.tagName === "text:list") walkList(c, 1)
        else collectParagraph(c, 0)
      }

      while (paras.length && paras[paras.length - 1].runs.length === 0) paras.pop()

      const boxStyle: CSSProperties = { ...gStyle.graphic }
      if (gStyle.fillNone) delete boxStyle.backgroundColor
      if (!paras.length && !Object.keys(boxStyle).length) return

      boxes.push({
        kind: "text",
        x, y, w, h,
        paras,
        boxStyle: Object.keys(boxStyle).length ? boxStyle : undefined,
        vAlign: gStyle.vAlign || "flex-start",
      })
    }

    const walkPage = (parent: Element) => {
      for (let j = 0; j < parent.childNodes.length; j++) {
        const node = parent.childNodes[j]
        if (node.nodeType !== 1) continue
        const el = node as Element
        if (el.tagName === "draw:g") { walkPage(el); continue }
        if (
          el.tagName === "draw:frame" ||
          el.tagName === "draw:custom-shape" ||
          el.tagName === "draw:rect" ||
          el.tagName === "draw:ellipse" ||
          el.tagName === "draw:text-box"
        ) {
          pushShape(el)
        }
      }
    }
    walkPage(page)

    slides.push({ boxes, background })
  }

  return { width, height, slides }
}
