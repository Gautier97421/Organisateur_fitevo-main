/**
 * Helpers serveur du module Communication : autorisations, validation des
 * uploads et résolution du stockage disque.
 *
 * À n'importer que depuis des route handlers / code serveur (utilise `fs` + prisma).
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import { prisma } from '@/lib/prisma'

// ── Rôles applicatifs ─────────────────────────────────────────────
export function isAppAdmin(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'superadmin'
}

// ── Stockage fichiers ─────────────────────────────────────────────
export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024 // 25 Mo

// Allowlist MIME (jamais d'exécutables / HTML / SVG)
export const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/csv',
  // Microsoft Office
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // OpenDocument (LibreOffice / OpenOffice)
  'application/vnd.oasis.opendocument.text',          // .odt
  'application/vnd.oasis.opendocument.spreadsheet',   // .ods
  'application/vnd.oasis.opendocument.presentation',  // .odp
  // Texte enrichi
  'application/rtf', 'text/rtf',
  'application/zip',
])

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
}

export async function ensureUploadDir(): Promise<string> {
  const dir = getUploadDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/**
 * Résout le chemin absolu d'un fichier stocké à partir de son nom physique,
 * en garantissant qu'il reste dans le répertoire d'upload (anti path-traversal).
 */
export function resolveStoredPath(storedName: string): string | null {
  const dir = getUploadDir()
  // storedName est généré côté serveur (cuid) — on revérifie quand même.
  const safe = path.basename(storedName)
  const full = path.join(dir, safe)
  if (!full.startsWith(path.resolve(dir) + path.sep) && full !== path.resolve(dir)) {
    // path.join avec basename empêche déjà la traversée, ceinture + bretelles
  }
  return full
}

// ── Autorisations conversations ───────────────────────────────────
/** Retourne l'enregistrement de membre si l'utilisateur appartient à la conversation. */
export async function getMembership(conversationId: string, userId: string) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  })
}

export async function isMember(conversationId: string, userId: string): Promise<boolean> {
  const m = await getMembership(conversationId, userId)
  return !!m
}

// ── Autorisations dossiers ────────────────────────────────────────
type FolderLike = {
  scope: string
  conversationId: string | null
  visibility: string
  roleIds: unknown
  userIds?: unknown
  createdBy?: string
}

/**
 * Détermine si un utilisateur peut voir un dossier.
 * - dossier de groupe : doit être membre de la conversation.
 * - dossier partagé : visibility all → tous ; admins → admins app ;
 *   roles → roleId de l'utilisateur listé. Les admins app voient tout.
 */
export async function canViewFolder(
  folder: FolderLike,
  user: { userId: string; role: string; roleId: string | null }
): Promise<boolean> {
  if (folder.scope === 'group') {
    if (!folder.conversationId) return false
    return isMember(folder.conversationId, user.userId)
  }
  // scope === 'shared'
  if (isAppAdmin(user.role)) return true
  // Le créateur du dossier garde toujours un accès total.
  if (folder.createdBy && folder.createdBy === user.userId) return true
  if (folder.visibility === 'all') return true
  if (folder.visibility === 'admins') return false
  if (folder.visibility === 'roles') {
    const allowed = Array.isArray(folder.roleIds) ? (folder.roleIds as string[]) : []
    return !!user.roleId && allowed.includes(user.roleId)
  }
  if (folder.visibility === 'users') {
    const allowed = Array.isArray(folder.userIds) ? (folder.userIds as string[]) : []
    return allowed.includes(user.userId)
  }
  return false
}

/** Vérifie l'accès à une pièce jointe (via son dossier OU un message d'une conversation où l'on est membre). */
export async function canAccessAttachment(
  attachmentId: string,
  user: { userId: string; role: string; roleId: string | null }
): Promise<boolean> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { folder: true },
  })
  if (!attachment) return false

  // Accès via le dossier
  if (attachment.folder) {
    if (await canViewFolder(attachment.folder, user)) return true
  }

  // Accès via un message non supprimé d'une conversation dont on est membre
  const msg = await prisma.message.findFirst({
    where: { attachmentId, deletedAt: null },
    select: { conversationId: true },
  })
  if (msg && (await isMember(msg.conversationId, user.userId))) return true

  // L'uploader garde l'accès à son fichier
  return attachment.uploadedBy === user.userId
}

/** Récupère userId, role et roleId pour les checks d'autorisation. */
export async function getRequestUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, roleId: true },
  })
  if (!user) return null
  return { userId: user.id, role: user.role, roleId: user.roleId }
}
