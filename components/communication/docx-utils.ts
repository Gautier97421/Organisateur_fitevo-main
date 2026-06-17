// Écriture de documents Word (.docx) à partir du contenu Tiptap (ProseMirror JSON).
// Un .docx est un zip OOXML (comme l'ODT) : on le génère avec fflate, sans dépendance.
// La lecture (.docx -> HTML) est assurée par mammoth côté éditeur/aperçu.
// Conserve : titres, gras/italique/barré, alignement, listes, citations, sauts de ligne.
// La mise en forme avancée (couleurs, polices exotiques, tableaux, images) est perdue.

const escXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function mapAlign(a?: string): string | null {
  if (a === "center") return "center"
  if (a === "right") return "right"
  if (a === "justify") return "both"
  if (a === "left") return "left"
  return null
}

// Propriétés d'un run (gras, italique, barré, code)
function runProps(marks: any[] = []): string {
  let rpr = ""
  if (marks.some((m) => m.type === "bold")) rpr += "<w:b/>"
  if (marks.some((m) => m.type === "italic")) rpr += "<w:i/>"
  if (marks.some((m) => m.type === "strike")) rpr += "<w:strike/>"
  if (marks.some((m) => m.type === "underline")) rpr += '<w:u w:val="single"/>'
  if (marks.some((m) => m.type === "code")) rpr += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>'
  return rpr ? `<w:rPr>${rpr}</w:rPr>` : ""
}

// Contenu inline -> runs OOXML
function renderInline(nodes: any[] | undefined): string {
  if (!nodes) return ""
  let out = ""
  for (const n of nodes) {
    if (n.type === "text") {
      out += `<w:r>${runProps(n.marks || [])}<w:t xml:space="preserve">${escXml(n.text || "")}</w:t></w:r>`
    } else if (n.type === "hardBreak") {
      out += "<w:r><w:br/></w:r>"
    } else if (n.content) {
      out += renderInline(n.content)
    }
  }
  return out
}

interface ParaOpts { style?: string; align?: string | null; numId?: number; ilvl?: number }

function paraProps(opts: ParaOpts): string {
  let ppr = ""
  if (opts.style) ppr += `<w:pStyle w:val="${opts.style}"/>`
  if (opts.numId) ppr += `<w:numPr><w:ilvl w:val="${opts.ilvl || 0}"/><w:numId w:val="${opts.numId}"/></w:numPr>`
  if (opts.align) ppr += `<w:jc w:val="${opts.align}"/>`
  return ppr ? `<w:pPr>${ppr}</w:pPr>` : ""
}

function para(inner: string, opts: ParaOpts = {}): string {
  return `<w:p>${paraProps(opts)}${inner}</w:p>`
}

function renderListItem(li: any, numId: number): string {
  return (li.content || [])
    .map((child: any) => {
      if (child.type === "paragraph") {
        return para(renderInline(child.content), { numId, ilvl: 0, align: mapAlign(child.attrs?.textAlign) })
      }
      return renderBlock(child)
    })
    .join("")
}

function renderBlock(node: any): string {
  switch (node.type) {
    case "heading": {
      const lvl = Math.min(3, Math.max(1, node.attrs?.level || 1))
      return para(renderInline(node.content), { style: `Heading${lvl}`, align: mapAlign(node.attrs?.textAlign) })
    }
    case "paragraph":
      return para(renderInline(node.content), { align: mapAlign(node.attrs?.textAlign) })
    case "codeBlock":
      return para(renderInline(node.content), { style: "CodeBlock" })
    case "blockquote":
      return (node.content || [])
        .map((c: any) =>
          c.type === "paragraph"
            ? para(renderInline(c.content), { style: "Quote", align: mapAlign(c.attrs?.textAlign) })
            : renderBlock(c),
        )
        .join("")
    case "bulletList":
      return (node.content || []).map((li: any) => renderListItem(li, 1)).join("")
    case "orderedList":
      return (node.content || []).map((li: any) => renderListItem(li, 2)).join("")
    default:
      return node.content ? node.content.map(renderBlock).join("") : ""
  }
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
  "</Types>"

const RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>"

const DOC_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
  "</Relationships>"

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  `<w:styles ${W_NS}>` +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="666666"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:fill="F2F2F2"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style>' +
  "</w:styles>"

const NUMBERING =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  `<w:numbering ${W_NS}>` +
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
  '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  "</w:numbering>"

/**
 * Construit un .docx à partir du JSON Tiptap (ProseMirror).
 * Conserve titres, styles de caractère, alignement, listes et citations.
 */
export async function tiptapJsonToDocx(json: any): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("fflate")
  const body = (json?.content || []).map(renderBlock).join("") || "<w:p/>"
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document ${W_NS}><w:body>${body}` +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    "</w:body></w:document>"

  return zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(STYLES),
    "word/numbering.xml": strToU8(NUMBERING),
    "word/_rels/document.xml.rels": strToU8(DOC_RELS),
  })
}
