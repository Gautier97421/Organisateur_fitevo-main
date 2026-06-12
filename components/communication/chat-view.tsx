"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft, Send, Paperclip, X, Settings, Users, Download, FileText,
  Loader2, Pin, PinOff, Images,
} from "lucide-react"
import { GroupSettingsDialog } from "./group-settings-dialog"
import type { ChatMessage, Conversation, AttachmentInfo } from "./types"

interface Props {
  conversation: Conversation
  currentUser: { id: string; name: string; role: string }
  liveMessage: ChatMessage | null
  isMobile: boolean
  title: string
  onBack: () => void
  onConversationChanged: () => void
}

interface ConvAttachment {
  messageId: string
  sentAt: string
  senderName: string
  attachment: AttachmentInfo
}

interface PinnedInfo {
  id: string
  content: string
  senderName: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return "Hier"
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

export function ChatView({
  conversation,
  currentUser,
  liveMessage,
  isMobile,
  title,
  onBack,
  onConversationChanged,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [convAttachments, setConvAttachments] = useState<ConvAttachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [pinnedInfo, setPinnedInfo] = useState<PinnedInfo | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const convId = conversation.id

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior }))
  }, [])

  // Réinitialiser le panel PJ à chaque changement de conversation
  useEffect(() => {
    setShowAttachments(false)
    setConvAttachments([])
  }, [convId])

  // Chargement initial
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setNextCursor(null)
    setPinnedInfo(null)
    ;(async () => {
      const res = await fetch(`/api/communication/conversations/${convId}/messages?limit=30`)
      if (cancelled) return
      if (res.ok) {
        const json = await res.json()
        setMessages(json.data || [])
        setNextCursor(json.nextCursor || null)
      }
      setLoading(false)
      scrollToBottom()
    })()
    return () => { cancelled = true }
  }, [convId, scrollToBottom])

  // Charger le message épinglé quand pinnedMessageId change
  useEffect(() => {
    if (!conversation.pinnedMessageId) { setPinnedInfo(null); return }
    let cancelled = false
    ;(async () => {
      // Chercher dans les messages déjà chargés
      const found = messages.find((m) => m.id === conversation.pinnedMessageId)
      if (found) {
        setPinnedInfo({ id: found.id, content: found.content, senderName: found.senderName })
        return
      }
      // Sinon fetch le message seul via l'API messages (réutiliser le curseur avant l'ID)
      // On charge les messages autour depuis la liste complète — fetch minimal
      const res = await fetch(
        `/api/communication/conversations/${convId}/messages?limit=1&before=${conversation.pinnedMessageId}_next`
      )
      if (cancelled) return
      // Fallback : afficher juste l'ID si on ne peut pas charger
      if (!res.ok) {
        setPinnedInfo({ id: conversation.pinnedMessageId, content: "", senderName: "" })
        return
      }
      // On va simplement marquer qu'il y a un message épinglé sans son contenu si non chargé
      setPinnedInfo({ id: conversation.pinnedMessageId, content: "", senderName: "" })
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.pinnedMessageId, convId])

  // Mettre à jour pinnedInfo quand les messages sont chargés et qu'il y a un pinnedMessageId
  useEffect(() => {
    if (!conversation.pinnedMessageId) return
    const found = messages.find((m) => m.id === conversation.pinnedMessageId)
    if (found) {
      setPinnedInfo({ id: found.id, content: found.content, senderName: found.senderName })
    }
  }, [messages, conversation.pinnedMessageId])

  // Message temps réel
  useEffect(() => {
    if (!liveMessage || liveMessage.conversationId !== convId) return
    setMessages((prev) => {
      if (prev.some((m) => m.id === liveMessage.id)) return prev
      return [...prev, liveMessage]
    })
    scrollToBottom("smooth")
  }, [liveMessage, convId, scrollToBottom])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    const el = scrollRef.current
    const prevHeight = el?.scrollHeight || 0
    const res = await fetch(
      `/api/communication/conversations/${convId}/messages?limit=30&before=${nextCursor}`
    )
    if (res.ok) {
      const json = await res.json()
      setMessages((prev) => [...(json.data || []), ...prev])
      setNextCursor(json.nextCursor || null)
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight
      })
    }
    setLoadingMore(false)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop < 60 && nextCursor && !loadingMore) loadMore()
  }

  const scrollToPinned = () => {
    if (!pinnedInfo) return
    const el = msgRefs.current.get(pinnedInfo.id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("bg-yellow-100", "dark:bg-yellow-900/30")
      setTimeout(() => el.classList.remove("bg-yellow-100", "dark:bg-yellow-900/30"), 1500)
    }
  }

  const pinMessage = async (messageId: string) => {
    const alreadyPinned = conversation.pinnedMessageId === messageId
    const res = await fetch(`/api/communication/conversations/${convId}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: alreadyPinned ? null : messageId }),
    })
    if (res.ok) onConversationChanged()
  }

  const send = async () => {
    const content = input.trim()
    if ((!content && !pendingFile) || sending) return
    setSending(true)
    try {
      let attachmentId: string | undefined
      if (pendingFile) {
        const fd = new FormData()
        fd.append("file", pendingFile)
        const up = await fetch("/api/communication/upload", { method: "POST", body: fd })
        if (!up.ok) {
          const err = await up.json().catch(() => ({}))
          alert(err.error || "Échec de l'envoi du fichier")
          setSending(false)
          return
        }
        const upJson = await up.json()
        attachmentId = upJson.data.id
      }

      const res = await fetch("/api/communication/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, content, attachmentId }),
      })
      if (res.ok) {
        const json = await res.json()
        const msg: ChatMessage = json.data
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        setInput("")
        setPendingFile(null)
        scrollToBottom("smooth")
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Échec de l'envoi")
      }
    } finally {
      setSending(false)
    }
  }

  const openAttachments = async () => {
    setShowAttachments(true)
    setLoadingAttachments(true)
    const res = await fetch(`/api/communication/conversations/${convId}/attachments`)
    if (res.ok) {
      const json = await res.json()
      setConvAttachments(json.data || [])
    }
    setLoadingAttachments(false)
  }

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (f.size > 25 * 1024 * 1024) { alert("Fichier trop volumineux (max 25 Mo)"); return }
      setPendingFile(f)
    }
    e.target.value = ""
  }

  const memberCount = conversation.members.length
  const canManageGroup =
    conversation.type === "group" &&
    (conversation.myRole === "admin" || currentUser.role === "admin" || currentUser.role === "superadmin")

  let lastDay = ""

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* En-tête */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {isMobile && (
          <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${
            conversation.type === "group" ? "bg-red-500" : "bg-gray-500"
          }`}
        >
          {conversation.type === "group" ? <Users className="w-5 h-5" /> : title.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white truncate">{title}</div>
          {conversation.type === "group" && (
            <div className="text-xs text-gray-500">{memberCount} membres</div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={openAttachments} className="px-2" title="Pièces jointes">
          <Images className="w-5 h-5" />
        </Button>
        {conversation.type === "group" && (
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="px-2">
            <Settings className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Banner message épinglé */}
      {pinnedInfo && (
        <button
          onClick={scrollToPinned}
          className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 text-left hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors group"
        >
          <Pin className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Message épinglé</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
              {pinnedInfo.senderName && <span className="font-medium">{pinnedInfo.senderName} : </span>}
              {pinnedInfo.content || <span className="italic text-gray-400">Pièce jointe</span>}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); pinMessage(pinnedInfo.id) }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1 transition-opacity"
            title="Désépingler"
          >
            <PinOff className="w-4 h-4" />
          </button>
        </button>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-1"
        >
          {loadingMore && (
            <div className="text-center py-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin inline" />
            </div>
          )}
          {loading ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Aucun message. Démarrez la conversation !</div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === currentUser.id
              const isPinned = conversation.pinnedMessageId === m.id
              const day = dayLabel(m.createdAt)
              const showDay = day !== lastDay
              lastDay = day
              return (
                <div
                  key={m.id}
                  ref={(el) => { el ? msgRefs.current.set(m.id, el) : msgRefs.current.delete(m.id) }}
                  className="transition-colors rounded-lg"
                >
                  {showDay && (
                    <div className="flex justify-center my-3">
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full">
                        {day}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`group relative max-w-[78%] rounded-2xl px-3 py-2 ${
                        isPinned ? "ring-2 ring-yellow-400 ring-offset-1" : ""
                      } ${
                        mine
                          ? "bg-red-600 text-white rounded-br-sm"
                          : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm shadow-sm"
                      }`}
                    >
                      {/* Bouton pin — apparaît uniquement au survol de la bulle */}
                      <button
                        onClick={() => pinMessage(m.id)}
                        className={`absolute -top-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full shadow-sm ${
                          mine
                            ? "left-1 bg-red-700 text-red-100 hover:text-yellow-300"
                            : "right-1 bg-white dark:bg-gray-600 text-gray-400 hover:text-yellow-500"
                        }`}
                        title={isPinned ? "Désépingler" : "Épingler"}
                      >
                        {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                      </button>
                      {!mine && (
                        <div className="text-xs font-semibold mb-0.5 text-red-600 dark:text-red-400">
                          {m.senderName}
                        </div>
                      )}
                      {m.attachment && <AttachmentBubble attachment={m.attachment} mine={mine} />}
                      {m.content && <div className="whitespace-pre-wrap break-words text-sm">{m.content}</div>}
                      <div className={`text-[10px] mt-1 text-right ${mine ? "text-red-100" : "text-gray-400"}`}>
                        {formatTime(m.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Panel pièces jointes */}
        {showAttachments && (
          <div className="w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-sm text-gray-900 dark:text-white">Pièces jointes</span>
              <button onClick={() => setShowAttachments(false)} className="text-gray-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ScrollArea className="flex-1">
              {loadingAttachments ? (
                <div className="p-4 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
              ) : convAttachments.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">Aucune pièce jointe.</div>
              ) : (
                <div className="p-2 space-y-1">
                  {convAttachments.map((item) => (
                    <a
                      key={item.messageId}
                      href={`/api/communication/files/${item.attachment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded group"
                    >
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm text-gray-900 dark:text-white">{item.attachment.fileName}</div>
                        <div className="text-xs text-gray-400">
                          {item.senderName} · {formatSize(item.attachment.size)}
                        </div>
                        <div className="text-xs text-gray-400">{formatDate(item.sentAt)}</div>
                      </div>
                      <Download className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Composeur */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-900">
        {pendingFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-sm">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="flex-1 truncate">{pendingFile.name}</span>
            <span className="text-xs text-gray-400">{formatSize(pendingFile.size)}</span>
            <button onClick={() => setPendingFile(null)} className="text-gray-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={onFilePick} />
          <Button
            variant="ghost" size="sm" className="px-2 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending} aria-label="Joindre un fichier"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Écrire un message..."
            rows={1}
            className="flex-1 resize-none max-h-32 min-h-[40px]"
          />
          <Button
            onClick={send}
            disabled={sending || (!input.trim() && !pendingFile)}
            className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {showSettings && (
        <GroupSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          conversation={conversation}
          currentUser={currentUser}
          canManage={canManageGroup}
          onChanged={onConversationChanged}
        />
      )}
    </div>
  )
}

function AttachmentBubble({ attachment, mine }: { attachment: AttachmentInfo; mine: boolean }) {
  const href = `/api/communication/files/${attachment.id}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 mb-1 px-2 py-1.5 rounded ${
        mine ? "bg-red-700/40" : "bg-gray-100 dark:bg-gray-600"
      }`}
    >
      <FileText className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1 truncate text-sm">{attachment.fileName}</span>
      <Download className="w-4 h-4 flex-shrink-0" />
    </a>
  )
}
