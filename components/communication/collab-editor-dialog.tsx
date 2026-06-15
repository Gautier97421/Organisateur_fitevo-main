"use client"

import { useEffect, useRef, useState } from "react"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCursor from "@tiptap/extension-collaboration-cursor"
import {
  Loader2, X, AlertTriangle, Bold, Italic, Strikethrough,
  Heading1, Heading2, List, ListOrdered, Quote, Code, Undo2, Redo2, Wifi, WifiOff,
} from "lucide-react"

interface CollabEditorDialogProps {
  docId: string
  docName: string
  readOnly?: boolean
  // "doc" = document collaboratif (export HTML) ; "text" = fichier .txt existant (texte brut)
  kind?: "doc" | "text"
  onClose: () => void
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

interface EditorSetup {
  ydoc: Y.Doc
  provider: WebsocketProvider
  user: { id: string; name: string; color: string }
}

export function CollabEditorDialog({ docId, docName, readOnly = false, kind = "doc", onClose }: CollabEditorDialogProps) {
  const [setup, setSetup] = useState<EditorSetup | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let provider: WebsocketProvider | null = null
    let ydoc: Y.Doc | null = null

    const init = async () => {
      try {
        const res = await fetch(`/api/communication/docs/${docId}/token`, { credentials: "same-origin" })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Impossible d'ouvrir le document")
        if (cancelled) return

        ydoc = new Y.Doc()
        const proto = window.location.protocol === "https:" ? "wss" : "ws"
        const wsBase = `${proto}://${window.location.host}/api/collab`
        provider = new WebsocketProvider(wsBase, docId, ydoc, {
          params: { token: json.data.token },
        })
        setSetup({ ydoc, provider, user: json.data.user })
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Impossible d'ouvrir le document")
      }
    }
    init()

    return () => {
      cancelled = true
      try { provider?.destroy() } catch { /* ignore */ }
      try { ydoc?.destroy() } catch { /* ignore */ }
    }
  }, [docId])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-gray-900">
      {error ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">{error}</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white">
              Fermer
            </button>
          </div>
        </div>
      ) : !setup ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            <span className="text-sm">Ouverture du document…</span>
          </div>
        </div>
      ) : (
        <EditorInner setup={setup} docId={docId} docName={docName} readOnly={readOnly} kind={kind} onClose={onClose} />
      )}
    </div>
  )
}

function EditorInner({
  setup, docId, docName, readOnly, kind, onClose,
}: {
  setup: EditorSetup
  docId: string
  docName: string
  readOnly: boolean
  kind: "doc" | "text"
  onClose: () => void
}) {
  const { ydoc, provider, user } = setup
  const [connected, setConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(1)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor(
    {
      editable: !readOnly,
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ history: false }),
        Placeholder.configure({ placeholder: "Commencez à écrire…" }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user: { name: user.name, color: user.color },
        }),
      ],
      editorProps: {
        attributes: {
          class: "tiptap-content focus:outline-none max-w-3xl mx-auto w-full",
        },
      },
    },
    [ydoc, provider],
  )

  // État de connexion + nombre de participants (awareness).
  useEffect(() => {
    const onStatus = (e: { status: string }) => setConnected(e.status === "connected")
    provider.on("status", onStatus)
    const awareness = provider.awareness
    const onAwareness = () => setPeerCount(Math.max(1, awareness.getStates().size))
    awareness.on("change", onAwareness)
    onAwareness()
    return () => {
      provider.off("status", onStatus)
      awareness.off("change", onAwareness)
    }
  }, [provider])

  // Amorçage du contenu pour un .txt existant : à la première synchro, si le
  // document collaboratif est vide, on y injecte le texte du fichier.
  useEffect(() => {
    if (!editor || kind !== "text") return
    let done = false
    const seed = async (isSynced: boolean) => {
      if (done || !isSynced || !editor.isEmpty) return
      done = true
      try {
        const res = await fetch(`/api/communication/files/${docId}?disposition=inline`, { credentials: "same-origin" })
        if (!res.ok) return
        const txt = await res.text()
        if (editor.isEmpty && txt) {
          const html = txt.split("\n").map((l) => `<p>${escapeHtml(l)}</p>`).join("")
          editor.commands.setContent(html)
        }
      } catch { /* ignore */ }
    }
    setup.provider.on("sync", seed)
    if ((setup.provider as any).synced) seed(true)
    return () => { setup.provider.off("sync", seed) }
  }, [editor, kind, docId, setup.provider])

  // Sauvegarde (anti-rebond) : HTML pour un doc collaboratif, texte brut pour un .txt.
  useEffect(() => {
    if (!editor || readOnly) return
    const save = () => {
      const body = kind === "text" ? { text: editor.getText() } : { html: editor.getHTML() }
      fetch(`/api/communication/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      }).catch(() => { /* best-effort */ })
    }
    const onUpdate = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(save, 1500)
    }
    editor.on("update", onUpdate)
    return () => {
      editor.off("update", onUpdate)
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [editor, readOnly, docId, kind])

  return (
    <>
      {/* Barre supérieure */}
      <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{docName}</span>
          {readOnly && <span className="text-xs text-gray-400 flex-shrink-0">Lecture seule</span>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs text-gray-400" title={connected ? "Connecté" : "Hors ligne"}>
            {connected ? <Wifi className="w-3.5 h-3.5 text-green-500" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
            {peerCount > 1 ? `${peerCount} en ligne` : "Vous"}
          </span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Barre d'outils */}
      {editor && !readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Gras"><Bold className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italique"><Italic className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Barré"><Strikethrough className="w-4 h-4" /></ToolbarButton>
          <Divider />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Titre 1"><Heading1 className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Titre 2"><Heading2 className="w-4 h-4" /></ToolbarButton>
          <Divider />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Liste à puces"><List className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Liste numérotée"><ListOrdered className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citation"><Quote className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Bloc de code"><Code className="w-4 h-4" /></ToolbarButton>
          <Divider />
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Annuler"><Undo2 className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Rétablir"><Redo2 className="w-4 h-4" /></ToolbarButton>
        </div>
      )}

      {/* Zone d'édition */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 dark:bg-gray-950 px-4 py-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 max-w-3xl mx-auto p-6 sm:p-10 min-h-[60vh]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  )
}

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "p-1.5 rounded-md transition-colors",
        active
          ? "bg-red-50 text-red-600 dark:bg-red-900/30"
          : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
}
