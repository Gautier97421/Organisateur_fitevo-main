// Utilitaires OpenDocument Text (.odt) côté client.
// Lecture (.odt -> HTML pour l'aperçu / l'amorçage de l'éditeur) et écriture
// (contenu Tiptap -> .odt minimal, avec perte de mise en forme avancée).

const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Convertit un .odt en HTML basique : titres, paragraphes, listes. */
export async function odtToHtml(buf: ArrayBuffer): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate")
  const files = unzipSync(new Uint8Array(buf))
  const contentBytes = files["content.xml"]
  if (!contentBytes) return ""
  const xml = strFromU8(contentBytes)
  const dom = new DOMParser().parseFromString(xml, "application/xml")
  const body = dom.getElementsByTagName("office:body")[0] || dom.documentElement

  const render = (node: Node): string => {
    let html = ""
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        html += escXml(child.nodeValue || "")
      } else if (child.nodeType === 1) {
        const el = child as Element
        const tag = el.tagName
        if (tag === "text:h") {
          const lvl = Math.min(3, Math.max(1, parseInt(el.getAttribute("text:outline-level") || "2", 10) || 2))
          html += `<h${lvl}>${render(el)}</h${lvl}>`
        } else if (tag === "text:p") {
          html += `<p>${render(el) || "&nbsp;"}</p>`
        } else if (tag === "text:list") {
          html += `<ul>${render(el)}</ul>`
        } else if (tag === "text:list-item") {
          html += `<li>${render(el)}</li>`
        } else if (tag === "text:line-break") {
          html += "<br/>"
        } else if (tag === "text:tab" || tag === "text:s") {
          html += " "
        } else {
          html += render(el)
        }
      }
    })
    return html
  }

  return render(body)
}

// ── Écriture : contenu Tiptap (ProseMirror JSON) -> .odt minimal ──

function renderInline(nodes: any[] | undefined): string {
  if (!nodes) return ""
  return nodes
    .map((n) => {
      if (n.type === "text") return escXml(n.text || "")
      if (n.type === "hardBreak") return "<text:line-break/>"
      if (n.content) return renderInline(n.content)
      return ""
    })
    .join("")
}

function renderBlock(node: any): string {
  switch (node.type) {
    case "heading": {
      const lvl = Math.min(6, Math.max(1, node.attrs?.level || 1))
      return `<text:h text:outline-level="${lvl}">${renderInline(node.content)}</text:h>`
    }
    case "paragraph":
    case "codeBlock":
      return `<text:p>${renderInline(node.content)}</text:p>`
    case "blockquote":
      return (node.content || []).map(renderBlock).join("")
    case "bulletList":
    case "orderedList":
      return `<text:list>${(node.content || []).map(renderBlock).join("")}</text:list>`
    case "listItem":
      return `<text:list-item>${(node.content || []).map(renderBlock).join("")}</text:list-item>`
    default:
      return node.content ? node.content.map(renderBlock).join("") : ""
  }
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"></office:document-styles>'

const MANIFEST_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
  '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>' +
  '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
  '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>' +
  "</manifest:manifest>"

/**
 * Construit un fichier .odt minimal à partir du JSON Tiptap (ProseMirror).
 * Conserve la structure (titres, paragraphes, listes) ; la mise en forme
 * avancée (couleurs, polices) est perdue.
 */
export async function tiptapJsonToOdt(json: any): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("fflate")
  const body = (json?.content || []).map(renderBlock).join("")
  const contentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"' +
    ' xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">' +
    `<office:body><office:text>${body}</office:text></office:body></office:document-content>`

  return zipSync({
    // Le mimetype doit être stocké sans compression.
    mimetype: [strToU8("application/vnd.oasis.opendocument.text"), { level: 0 }],
    "content.xml": strToU8(contentXml),
    "styles.xml": strToU8(STYLES_XML),
    "META-INF/manifest.xml": strToU8(MANIFEST_XML),
  })
}
