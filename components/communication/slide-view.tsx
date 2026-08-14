"use client"

// Rendu d'une diapositive (issue de presentation-utils) : les boîtes sont posées
// en absolu dans un « canevas » aux dimensions réelles de la diapositive, lui-même
// mis à l'échelle de la largeur disponible. Les tailles de police restent donc
// proportionnelles à la diapositive, quelle que soit la taille de l'écran.

import { useEffect, useRef, useState } from "react"
import type { LoadedSlide, SlidePara } from "./presentation-utils"

function Paragraph({ para }: { para: SlidePara }) {
  const hasText = para.runs.length > 0
  return (
    <div
      style={{
        textAlign: para.align || "left",
        paddingLeft: para.level * 24 + (para.bullet ? 0 : 0),
        display: "flex",
        gap: 8,
        justifyContent:
          para.align === "center" ? "center" : para.align === "right" ? "flex-end" : "flex-start",
        minHeight: hasText ? undefined : "0.6em",
      }}
    >
      {para.bullet && <span style={{ flexShrink: 0, lineHeight: 1.3 }}>{para.bullet}</span>}
      <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.3, minWidth: 0 }}>
        {para.runs.map((run, i) => (
          <span key={i} style={run.style}>{run.text}</span>
        ))}
      </span>
    </div>
  )
}

export function SlideView({
  slide,
  width,
  height,
}: {
  slide: LoadedSlide
  width: number
  height: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || !width) return
    const update = () => setScale(el.clientWidth / width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm"
      style={{ aspectRatio: `${width} / ${height}`, backgroundColor: slide.background || "#ffffff" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          color: "#000",
          fontFamily: "Arial, Helvetica, sans-serif",
          visibility: scale ? "visible" : "hidden",
        }}
      >
        {slide.boxes.map((box, i) => {
          const common = {
            position: "absolute" as const,
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            transform: box.rot ? `rotate(${box.rot}deg)` : undefined,
          }

          if (box.kind === "image") {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={box.src}
                alt=""
                style={{ ...common, objectFit: "contain" }}
              />
            )
          }

          if (box.kind === "table") {
            return (
              <div key={i} style={{ ...common, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  {box.colWidths && box.colWidths.length > 0 && (
                    <colgroup>
                      {box.colWidths.map((w, c) => <col key={c} style={{ width: w }} />)}
                    </colgroup>
                  )}
                  <tbody>
                    {(box.rows || []).map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            style={{
                              border: "1px solid #bbb",
                              padding: "4px 6px",
                              verticalAlign: "top",
                              ...cell.style,
                            }}
                          >
                            {cell.paras.map((para, p) => <Paragraph key={p} para={para} />)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          return (
            <div
              key={i}
              style={{
                ...common,
                ...box.boxStyle,
                display: "flex",
                flexDirection: "column",
                justifyContent: box.vAlign || "flex-start",
                padding: "4px 8px",
                overflow: "hidden",
              }}
            >
              {(box.paras || []).map((para, p) => <Paragraph key={p} para={para} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
