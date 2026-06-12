"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Users, Paperclip } from "lucide-react"
import type { Conversation } from "./types"
import { conversationTitle } from "./types"

interface Props {
  conversations: Conversation[]
  currentUserId: string
  activeId: string | null
  loading: boolean
  onSelect: (id: string) => void
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatTime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
}

export function ConversationList({ conversations, currentUserId, activeId, loading, onSelect }: Props) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) =>
      conversationTitle(c, currentUserId).toLowerCase().includes(q)
    )
  }, [conversations, search, currentUserId])

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-2 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-8 h-9 bg-gray-50 dark:bg-gray-800"
          />
        </div>
      </div>

      <ScrollArea className="flex-1" viewportClassName="pr-3">
        {loading ? (
          <div className="p-4 text-sm text-gray-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">Aucune conversation</div>
        ) : (
          <ul>
            {filtered.map((conv) => {
              const title = conversationTitle(conv, currentUserId)
              const isActive = conv.id === activeId
              const last = conv.lastMessage
              const preview = last
                ? `${last.senderId === currentUserId ? "Vous : " : conv.type === "group" ? last.senderName + " : " : ""}${
                    last.hasAttachment && !last.content ? "📎 Pièce jointe" : last.content
                  }`
                : "Nouvelle conversation"
              return (
                <li key={conv.id}>
                  <button
                    onClick={() => onSelect(conv.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors border-b border-gray-50 dark:border-gray-800 ${
                      isActive
                        ? "bg-red-50 dark:bg-red-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        conv.type === "group" ? "bg-red-500" : "bg-gray-500 dark:bg-gray-600"
                      }`}
                    >
                      {conv.type === "group" ? <Users className="w-5 h-5" /> : initials(title)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="flex-1 min-w-0 font-medium text-gray-900 dark:text-white truncate">{title}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">{formatTime(conv.lastMessageAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="flex-1 min-w-0 text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                          {last?.hasAttachment && last?.content && <Paperclip className="w-3 h-3 flex-shrink-0" />}
                          {preview}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="flex-shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-medium">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
