"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle, MessageSquare, FolderClosed, Plus, X } from "lucide-react"
import { useIsMobile } from "@/components/ui/use-mobile"
import { useRealtime } from "./use-realtime"
import { ConversationList } from "./conversation-list"
import { ChatView } from "./chat-view"
import { NewConversationDialog } from "./new-conversation-dialog"
import { FoldersPanel } from "./folders-panel"
import type { Conversation, RealtimeEvent, ChatMessage } from "./types"
import { conversationTitle } from "./types"
import { getUserId, getUserName, getUserRole } from "@/lib/current-user"

interface CurrentUser {
  id: string
  name: string
  role: string
}

/**
 * Widget de messagerie flottant (bulle en bas à droite).
 *
 * Monté en permanence au niveau de la page : la connexion WebSocket reste
 * active même quand le panneau est fermé, ce qui permet de recevoir les
 * notifications et le badge de non-lus en temps réel sans recharger.
 */
export function CommunicationWidget() {
  const isMobile = useIsMobile()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"messages" | "folders">("messages")
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewDialog, setShowNewDialog] = useState(false)
  // Dernier message reçu en temps réel, consommé par ChatView
  const [liveMessage, setLiveMessage] = useState<ChatMessage | null>(null)
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  useEffect(() => {
    setUser({
      id: getUserId(),
      name: getUserName(),
      role: getUserRole(),
    })
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/communication/conversations")
      if (res.ok) {
        const json = await res.json()
        setConversations(json.data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) loadConversations()
  }, [user, loadConversations])

  // Réception temps réel — actif en permanence (widget toujours monté)
  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.type !== "message") return
      const msg = event.message
      setLiveMessage(msg)

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId)
        if (idx === -1) {
          // Nouvelle conversation pour cet utilisateur → recharger la liste
          loadConversations()
          return prev
        }
        const updated = [...prev]
        const conv = { ...updated[idx] }
        conv.lastMessageAt = msg.createdAt
        conv.lastMessage = {
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          senderName: msg.senderName,
          hasAttachment: !!msg.attachment,
          createdAt: msg.createdAt,
        }
        const isActiveOpen = open && activeIdRef.current === msg.conversationId
        const isMine = msg.senderId === user?.id
        if (!isActiveOpen && !isMine) conv.unreadCount += 1
        updated.splice(idx, 1)
        updated.unshift(conv)
        return updated
      })
    },
    [loadConversations, user?.id, open]
  )

  useRealtime(handleEvent, !!user)

  const markRead = useCallback(async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    )
    await fetch(`/api/communication/conversations/${conversationId}/read`, { method: "PATCH" }).catch(() => {})
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      setActiveId(id)
      markRead(id)
    },
    [markRead]
  )

  const handleCreated = useCallback(
    async (conversationId: string) => {
      setShowNewDialog(false)
      await loadConversations()
      setActiveId(conversationId)
      markRead(conversationId)
    },
    [loadConversations, markRead]
  )

  // Quand un message arrive pour la conversation active et ouverte, marquer lu
  useEffect(() => {
    if (
      open &&
      liveMessage &&
      activeId === liveMessage.conversationId &&
      liveMessage.senderId !== user?.id
    ) {
      markRead(activeId)
    }
  }, [liveMessage, activeId, user?.id, markRead, open])

  if (!user) return null

  const activeConversation = conversations.find((c) => c.id === activeId) || null
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  const showList = !isMobile || !activeId || view === "folders"
  const showChat = view === "messages" && (!isMobile || !!activeId)
  // Sur desktop, le panneau s'agrandit dès qu'une conversation est ouverte ou en vue Dossiers
  const expanded = !isMobile && (view === "folders" || (view === "messages" && !!activeId))

  return (
    <>
      {/* Bouton bulle flottant */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir la messagerie"
          className="fixed bottom-5 right-5 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="w-7 h-7" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-white text-red-600 text-xs font-bold border-2 border-red-600">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Panneau de messagerie */}
      {open && (
        <div
          className={
            isMobile
              ? "fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900"
              : `fixed bottom-5 right-5 md:bottom-6 md:right-6 z-50 flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden transition-all duration-200 ${
                  expanded ? "w-[980px] max-w-[92vw] h-[85vh]" : "w-[420px] h-[640px] max-h-[85vh]"
                }`
          }
        >
          {/* En-tête du widget */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-red-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2 font-semibold">
              <MessageCircle className="w-5 h-5" />
              Messagerie
              {totalUnread > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white text-red-600 text-xs font-bold">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer la messagerie"
              className="p-1.5 rounded-lg hover:bg-red-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Onglets internes */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <Button
              variant={view === "messages" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("messages")}
              className={view === "messages" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </Button>
            <Button
              variant={view === "folders" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("folders")}
              className={view === "folders" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
            >
              <FolderClosed className="w-4 h-4 mr-2" />
              Dossiers
            </Button>
          </div>

          {/* Corps */}
          {view === "messages" ? (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {showList && (
                <div
                  className={`${
                    isMobile ? "w-full" : "w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700"
                  } flex flex-col min-h-0 bg-white dark:bg-gray-900`}
                >
                  <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Conversations</h3>
                    <Button size="sm" onClick={() => setShowNewDialog(true)} className="bg-red-600 hover:bg-red-700 text-white">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <ConversationList
                    conversations={conversations}
                    currentUserId={user.id}
                    activeId={activeId}
                    loading={loading}
                    onSelect={handleSelect}
                  />
                </div>
              )}

              {showChat && (
                <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-800">
                  {activeConversation ? (
                    <ChatView
                      conversation={activeConversation}
                      currentUser={user}
                      liveMessage={liveMessage}
                      isMobile={isMobile}
                      onBack={() => setActiveId(null)}
                      onConversationChanged={loadConversations}
                      title={conversationTitle(activeConversation, user.id)}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 p-4">
                      <div className="text-center">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Sélectionnez une conversation</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-gray-900">
              <FoldersPanel currentUser={user} conversations={conversations} />
            </div>
          )}
        </div>
      )}

      {showNewDialog && (
        <NewConversationDialog
          open={showNewDialog}
          onOpenChange={setShowNewDialog}
          currentUserRole={user.role}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
