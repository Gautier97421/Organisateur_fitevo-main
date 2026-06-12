// Types partagés du module Communication (côté client)

export interface DirectoryUser {
  id: string
  name: string
  email: string
  role: string
  employeeRole?: { id: string; name: string; color: string } | null
}

export interface ConversationMemberInfo {
  userId: string
  role: string // "admin" | "member"
  name: string
  email: string
  userRole: string // rôle applicatif
}

export interface LastMessage {
  id: string
  content: string
  senderId: string
  senderName: string
  hasAttachment: boolean
  createdAt: string
}

export interface Conversation {
  id: string
  type: "direct" | "group"
  name: string | null
  lastMessageAt: string | null
  createdBy: string
  myRole: string
  unreadCount: number
  members: ConversationMemberInfo[]
  lastMessage: LastMessage | null
  pinnedMessageId: string | null
}

export interface AttachmentInfo {
  id: string
  fileName: string
  mimeType: string
  size: number
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  attachment: AttachmentInfo | null
  createdAt: string
  editedAt?: string | null
}

export interface Folder {
  id: string
  name: string
  scope: "shared" | "group"
  conversationId: string | null
  parentId: string | null
  visibility: string
  roleIds: unknown
  userIds: unknown
  createdBy: string
}

export interface FolderFile {
  id: string
  fileName: string
  mimeType: string
  size: number
  uploadedBy: string
  uploaderName: string
  uploadedAt: string
}

// Évènement reçu via WebSocket
export type RealtimeEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "pong" }

/** Affiche le nom d'une conversation pour l'utilisateur courant. */
export function conversationTitle(conv: Conversation, currentUserId: string): string {
  if (conv.type === "group") return conv.name || "Groupe"
  const other = conv.members.find((m) => m.userId !== currentUserId)
  return other?.name || "Conversation"
}
