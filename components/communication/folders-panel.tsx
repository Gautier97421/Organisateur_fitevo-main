"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  FolderClosed, FolderPlus, Upload, Download, FileText, ChevronRight,
  Trash2, Loader2, Home, Search, Check, ArrowUpDown, Plus, Users, Info, Pencil,
} from "lucide-react"
import type { Conversation, Folder, FolderFile, DirectoryUser } from "./types"
import { conversationTitle } from "./types"

interface Props {
  currentUser: { id: string; name: string; role: string }
  conversations: Conversation[]
}

type FolderWithMeta = Folder & { conversationName?: string | null }
type PathItem = { id: string; name: string; scope: string; conversationId: string | null }
type SortKey = "name_asc" | "name_desc" | "date_desc" | "date_asc" | "size_desc" | "size_asc"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function visibilityLabel(v: string): string {
  if (v === "admins") return "Admins"
  if (v === "roles") return "Rôles"
  if (v === "users") return "Personnes"
  return ""
}

export function FoldersPanel({ currentUser, conversations }: Props) {
  const isAdmin = currentUser.role === "admin" || currentUser.role === "superadmin"
  const groups = conversations.filter((c) => c.type === "group")

  const [rootFolders, setRootFolders] = useState<FolderWithMeta[]>([])
  const [path, setPath] = useState<PathItem[]>([])
  const [children, setChildren] = useState<FolderWithMeta[]>([])
  const [files, setFiles] = useState<FolderFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("name_asc")
  const [infoFolder, setInfoFolder] = useState<FolderWithMeta | null>(null)
  const [infoStats, setInfoStats] = useState<{ folderCount: number; fileCount: number; totalSize: number; accessLabel: string; createdAt: string } | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [editFolder, setEditFolder] = useState<FolderWithMeta | null>(null)
  const newMenuRef = useRef<HTMLDivElement>(null)

  const inRoot = path.length === 0
  const currentFolder = path.length > 0 ? path[path.length - 1] : null
  const currentFolderId = currentFolder?.id ?? null

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const loadRoot = useCallback(async () => {
    setLoading(true)
    setPath([])
    const res = await fetch("/api/communication/folders")
    if (res.ok) {
      const json = await res.json()
      setRootFolders(json.data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadRoot() }, [loadRoot])

  const openFolder = async (folder: FolderWithMeta) => {
    setLoading(true)
    const res = await fetch(`/api/communication/folders/${folder.id}`)
    if (res.ok) {
      const json = await res.json()
      setChildren(json.data.children || [])
      setFiles(json.data.files || [])
      setPath((prev) => [...prev, {
        id: folder.id,
        name: folder.name,
        scope: folder.scope,
        conversationId: folder.conversationId ?? null,
      }])
    }
    setLoading(false)
  }

  const refreshCurrent = async () => {
    if (!currentFolderId) { loadRoot(); return }
    const res = await fetch(`/api/communication/folders/${currentFolderId}`)
    if (res.ok) {
      const json = await res.json()
      setChildren(json.data.children || [])
      setFiles(json.data.files || [])
    }
  }

  const goToCrumb = async (index: number) => {
    if (index < 0) { loadRoot(); return }
    const target = path[index]
    setPath((prev) => prev.slice(0, index + 1))
    const res = await fetch(`/api/communication/folders/${target.id}`)
    if (res.ok) {
      const json = await res.json()
      setChildren(json.data.children || [])
      setFiles(json.data.files || [])
    }
  }

  const uploadFile = async (f: File) => {
    if (!currentFolderId) return
    if (f.size > 25 * 1024 * 1024) { alert("Fichier trop volumineux (max 25 Mo)"); return }
    setUploading(true)
    const fd = new FormData()
    fd.append("file", f)
    fd.append("folderId", currentFolderId)
    const res = await fetch("/api/communication/upload", { method: "POST", body: fd })
    setUploading(false)
    if (res.ok) refreshCurrent()
    else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Échec de l'envoi")
    }
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (f) uploadFile(f)
  }

  const openFolderInfo = async (folder: FolderWithMeta) => {
    setInfoFolder(folder)
    setInfoStats(null)
    setInfoLoading(true)
    const res = await fetch(`/api/communication/folders/${folder.id}/stats`)
    if (res.ok) {
      const json = await res.json()
      setInfoStats(json.data)
    }
    setInfoLoading(false)
  }

  const deleteFolder = async (id: string) => {
    if (!confirm("Supprimer ce dossier et son contenu ?")) return
    const res = await fetch(`/api/communication/folders/${id}`, { method: "DELETE" })
    if (res.ok) inRoot ? loadRoot() : refreshCurrent()
    else alert("Suppression impossible")
  }

  const rawFolders: FolderWithMeta[] = inRoot ? rootFolders : children

  const sortedFolders = [...rawFolders].sort((a, b) => {
    if (sortKey === "name_desc") return b.name.localeCompare(a.name, "fr")
    return a.name.localeCompare(b.name, "fr")
  })

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortKey) {
      case "name_asc":  return a.fileName.localeCompare(b.fileName, "fr")
      case "name_desc": return b.fileName.localeCompare(a.fileName, "fr")
      case "date_desc": return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      case "date_asc":  return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
      case "size_desc": return b.size - a.size
      case "size_asc":  return a.size - b.size
      default: return 0
    }
  })

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Barre supérieure */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative" ref={newMenuRef}>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => setShowNewMenu((v) => !v)}
          >
            <Plus className="w-4 h-4 mr-1" /> Nouveau
          </Button>
          {showNewMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg min-w-[190px] py-1">
              <button
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 text-left"
                onClick={() => { setShowCreate(true); setShowNewMenu(false) }}
              >
                <FolderPlus className="w-4 h-4 text-red-500" />
                Nouveau dossier
              </button>
              {!inRoot && (
                <label className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                  <input type="file" className="hidden" onChange={(e) => { onUpload(e); setShowNewMenu(false) }} disabled={uploading} />
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Upload className="w-4 h-4 text-gray-500" />}
                  Déposer un fichier
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-40 h-9 text-xs gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Nom A → Z</SelectItem>
            <SelectItem value="name_desc">Nom Z → A</SelectItem>
            <SelectItem value="date_desc">Date récente</SelectItem>
            <SelectItem value="date_asc">Date ancienne</SelectItem>
            <SelectItem value="size_desc">Taille ↓</SelectItem>
            <SelectItem value="size_asc">Taille ↑</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 overflow-x-auto">
        <button onClick={() => goToCrumb(-1)} className="flex items-center hover:text-red-600 flex-shrink-0">
          <Home className="w-4 h-4" />
        </button>
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1 flex-shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <button onClick={() => goToCrumb(i)} className="hover:text-red-600 truncate max-w-[120px]">{p.name}</button>
          </span>
        ))}
      </div>

      {/* Contenu */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : sortedFolders.length === 0 && sortedFiles.length === 0 ? (
          inRoot ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              Aucun dossier. Cliquez sur « + Nouveau » pour en créer un.
            </div>
          ) : (
            <div
              className={`m-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
                dragOver ? "border-red-400 bg-red-50 dark:bg-red-900/10" : "border-gray-200 dark:border-gray-700"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) uploadFile(file)
              }}
            >
              <Upload className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-400 text-center">Glissez un fichier ici</p>
              <label className={`cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadFile(f) }}
                  disabled={uploading}
                />
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Parcourir
                </span>
              </label>
            </div>
          )
        ) : (
          <div className="p-2">
            {sortedFolders.map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg group">
                <button onClick={() => openFolder(f)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  {f.conversationName
                    ? <Users className="w-5 h-5 text-red-400 flex-shrink-0" />
                    : <FolderClosed className="w-5 h-5 text-red-500 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-gray-900 dark:text-white">{f.name}</div>
                    {f.conversationName && <div className="text-xs text-gray-400 truncate">{f.conversationName}</div>}
                    {!f.conversationName && f.visibility && f.visibility !== "all" && (
                      <div className="text-xs text-gray-400">{visibilityLabel(f.visibility)}</div>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openFolderInfo(f) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 p-1 transition-opacity"
                  title="Informations"
                >
                  <Info className="w-4 h-4" />
                </button>
                {(isAdmin || f.createdBy === currentUser.id) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditFolder(f) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-green-600 p-1 transition-opacity"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {(isAdmin || f.createdBy === currentUser.id) && (
                  <button
                    onClick={() => deleteFolder(f.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1 transition-opacity"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {sortedFiles.map((file) => (
              <a
                key={file.id}
                href={`/api/communication/files/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg group"
              >
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm text-gray-900 dark:text-white">{file.fileName}</div>
                  <div className="text-xs text-gray-400">
                    {file.uploaderName} · {formatSize(file.size)} · {new Date(file.uploadedAt).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <Download className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </ScrollArea>

      {infoFolder && (
        <Dialog open={!!infoFolder} onOpenChange={(v) => { if (!v) setInfoFolder(null) }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {infoFolder.conversationName ? <Users className="w-4 h-4 text-red-400" /> : <FolderClosed className="w-4 h-4 text-red-500" />}
                {infoFolder.name}
              </DialogTitle>
            </DialogHeader>
            {infoLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : infoStats ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Sous-dossiers</span>
                  <span className="font-medium">{infoStats.folderCount}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Documents</span>
                  <span className="font-medium">{infoStats.fileCount}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Taille totale</span>
                  <span className="font-medium">{formatSize(infoStats.totalSize)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Accès</span>
                  <span className="font-medium">{infoFolder.conversationName ? infoFolder.conversationName : infoStats.accessLabel}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Créé le</span>
                  <span className="font-medium">{new Date(infoStats.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center">Impossible de charger les informations.</p>
            )}
          </DialogContent>
        </Dialog>
      )}

      {editFolder && (
        <EditFolderDialog
          open={!!editFolder}
          folder={editFolder}
          isAdmin={isAdmin}
          onOpenChange={(v: boolean) => { if (!v) setEditFolder(null) }}
          onSaved={(updated) => {
            setEditFolder(null)
            if (inRoot) {
              setRootFolders((prev) => prev.map((f) => f.id === updated.id ? { ...f, ...updated } : f))
            } else {
              setChildren((prev) => prev.map((f) => f.id === updated.id ? { ...f, ...updated } : f))
            }
          }}
        />
      )}

      {showCreate && (
        <CreateFolderDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          isAdmin={isAdmin}
          groups={groups}
          currentUserId={currentUser.id}
          parentFolder={currentFolder}
          onCreated={() => {
            setShowCreate(false)
            inRoot ? loadRoot() : refreshCurrent()
          }}
        />
      )}
    </div>
  )
}

// ─── Dialogue "Nouveau dossier" ───────────────────────────────────────────────

type AccessType = "all" | "admins" | "roles" | "users" | "group"

function CreateFolderDialog({
  open, onOpenChange, isAdmin, groups, currentUserId, parentFolder, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  isAdmin: boolean
  groups: Conversation[]
  currentUserId: string
  parentFolder: PathItem | null
  onCreated: () => void
}) {
  const isSubFolder = parentFolder !== null
  const inheritedConvId = parentFolder?.conversationId ?? null

  const [name, setName] = useState("")
  const [access, setAccess] = useState<AccessType>(
    isSubFolder
      ? (parentFolder.scope === "group" ? "group" : "all")
      : (isAdmin ? "all" : "group")
  )
  const [selectedGroupId, setSelectedGroupId] = useState(
    inheritedConvId ?? groups[0]?.id ?? ""
  )
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [userSearch, setUserSearch] = useState("")
  const [userCandidates, setUserCandidates] = useState<DirectoryUser[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isAdmin && !isSubFolder) {
      fetch("/api/db/roles").then((r) => r.ok ? r.json() : { data: [] }).then((j) => setRoles(j.data || [])).catch(() => {})
    }
  }, [isAdmin, isSubFolder])

  useEffect(() => {
    if (access !== "users" || isSubFolder) return
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await fetch(`/api/communication/directory?q=${encodeURIComponent(userSearch)}`)
      if (!cancelled && res.ok) {
        const json = await res.json()
        setUserCandidates(json.data || [])
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [access, userSearch, isSubFolder])

  const toggleUser = (id: string) =>
    setSelectedUsers((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const create = async () => {
    if (name.trim().length < 1) { alert("Nom requis"); return }
    setBusy(true)

    let body: Record<string, unknown>

    if (isSubFolder) {
      body = {
        name: name.trim(),
        parentId: parentFolder!.id,
        scope: parentFolder!.scope,
        ...(parentFolder!.scope === "group" ? { conversationId: inheritedConvId } : { visibility: "all" }),
      }
    } else if (access === "group") {
      body = { name: name.trim(), scope: "group", conversationId: selectedGroupId }
    } else {
      body = {
        name: name.trim(),
        scope: "shared",
        visibility: access,
        ...(access === "roles" ? { roleIds: [...selectedRoles] } : {}),
        ...(access === "users" ? { userIds: [...selectedUsers] } : {}),
      }
    }

    const res = await fetch("/api/communication/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (res.ok) onCreated()
    else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Erreur")
    }
  }

  const canSubmit = !busy && name.trim().length > 0 &&
    (isSubFolder || (access === "group" ? !!selectedGroupId : true)) &&
    (!isAdmin && groups.length === 0 ? false : true)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSubFolder ? "Nouveau sous-dossier" : "Nouveau dossier"}</DialogTitle>
        </DialogHeader>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du dossier"
          maxLength={100}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") create() }}
        />

        {!isSubFolder && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Qui peut accéder à ce dossier ?
            </label>

            {isAdmin && (
              <Select value={access} onValueChange={(v) => setAccess(v as AccessType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout le monde</SelectItem>
                  <SelectItem value="admins">Administrateurs uniquement</SelectItem>
                  <SelectItem value="roles">Rôles spécifiques</SelectItem>
                  <SelectItem value="users">Personnes spécifiques</SelectItem>
                  <SelectItem value="group">Un groupe</SelectItem>
                </SelectContent>
              </Select>
            )}

            {!isAdmin && groups.length === 0 && (
              <p className="text-sm text-gray-400">Vous devez être membre d'un groupe pour créer un dossier.</p>
            )}

            {(access === "group" || !isAdmin) && groups.length > 0 && (
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger><SelectValue placeholder="Choisir un groupe" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{conversationTitle(g, currentUserId)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {access === "roles" && isAdmin && (
              <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {roles.length === 0 && <div className="text-xs text-gray-400">Aucun rôle disponible</div>}
                {roles.map((r) => {
                  const sel = selectedRoles.has(r.id)
                  return (
                    <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox" checked={sel}
                        onChange={() => setSelectedRoles((prev) => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
                      />
                      {r.name}
                    </label>
                  )
                })}
              </div>
            )}

            {access === "users" && isAdmin && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Rechercher une personne..." className="pl-8" />
                </div>
                {selectedUsers.size > 0 && (
                  <div className="text-xs text-red-600">{selectedUsers.size} personne{selectedUsers.size > 1 ? "s" : ""} sélectionnée{selectedUsers.size > 1 ? "s" : ""}</div>
                )}
                <div className="border border-gray-100 dark:border-gray-800 rounded-lg max-h-36 overflow-y-auto">
                  {userCandidates.length === 0
                    ? <div className="text-xs text-gray-400 p-2">Aucun résultat</div>
                    : userCandidates.map((u) => {
                        const sel = selectedUsers.has(u.id)
                        return (
                          <button key={u.id} type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                            onClick={() => toggleUser(u.id)}
                          >
                            <div className="w-7 h-7 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs flex-shrink-0">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="flex-1 truncate text-sm">{u.name}</span>
                            <span className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${sel ? "bg-red-600 border-red-600" : "border-gray-300"}`}>
                              {sel && <Check className="w-3.5 h-3.5 text-white" />}
                            </span>
                          </button>
                        )
                      })
                  }
                </div>
              </div>
            )}
          </div>
        )}

        <Button onClick={create} disabled={!canSubmit} className="bg-red-600 hover:bg-red-700 text-white w-full">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialogue "Modifier un dossier" ──────────────────────────────────────────

function EditFolderDialog({
  open, onOpenChange, folder, isAdmin, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  folder: FolderWithMeta
  isAdmin: boolean
  onSaved: (updated: Partial<FolderWithMeta>) => void
}) {
  const [name, setName] = useState(folder.name)
  const [access, setAccess] = useState<"all" | "admins" | "roles" | "users">(
    (folder.visibility as "all" | "admins" | "roles" | "users") || "all"
  )
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    new Set(Array.isArray(folder.roleIds) ? (folder.roleIds as string[]) : [])
  )
  const [userSearch, setUserSearch] = useState("")
  const [userCandidates, setUserCandidates] = useState<DirectoryUser[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(
    new Set(Array.isArray(folder.userIds) ? (folder.userIds as string[]) : [])
  )
  const [busy, setBusy] = useState(false)

  const isShared = folder.scope === "shared"

  useEffect(() => {
    if (isAdmin && isShared) {
      fetch("/api/db/roles").then((r) => r.ok ? r.json() : { data: [] }).then((j) => setRoles(j.data || [])).catch(() => {})
    }
  }, [isAdmin, isShared])

  useEffect(() => {
    if (access !== "users" || !isShared) return
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await fetch(`/api/communication/directory?q=${encodeURIComponent(userSearch)}`)
      if (!cancelled && res.ok) {
        const json = await res.json()
        setUserCandidates(json.data || [])
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [access, userSearch, isShared])

  const toggleUser = (id: string) =>
    setSelectedUsers((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const save = async () => {
    const trimmed = name.trim()
    if (trimmed.length < 1) { alert("Nom requis"); return }
    setBusy(true)

    const body: Record<string, unknown> = { name: trimmed }
    if (isAdmin && isShared) {
      body.visibility = access
      if (access === "roles") body.roleIds = [...selectedRoles]
      if (access === "users") body.userIds = [...selectedUsers]
    }

    const res = await fetch(`/api/communication/folders/${folder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (res.ok) {
      const json = await res.json()
      onSaved({ ...json.data, conversationName: folder.conversationName })
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Erreur lors de la modification")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le dossier</DialogTitle>
        </DialogHeader>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du dossier"
          maxLength={100}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") save() }}
        />

        {isAdmin && isShared && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Qui peut accéder ?</label>
            <Select value={access} onValueChange={(v) => setAccess(v as typeof access)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout le monde</SelectItem>
                <SelectItem value="admins">Administrateurs uniquement</SelectItem>
                <SelectItem value="roles">Rôles spécifiques</SelectItem>
                <SelectItem value="users">Personnes spécifiques</SelectItem>
              </SelectContent>
            </Select>

            {access === "roles" && (
              <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {roles.length === 0 && <div className="text-xs text-gray-400">Aucun rôle disponible</div>}
                {roles.map((r) => {
                  const sel = selectedRoles.has(r.id)
                  return (
                    <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={sel}
                        onChange={() => setSelectedRoles((prev) => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
                      />
                      {r.name}
                    </label>
                  )
                })}
              </div>
            )}

            {access === "users" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Rechercher une personne..." className="pl-8" />
                </div>
                {selectedUsers.size > 0 && (
                  <div className="text-xs text-red-600">{selectedUsers.size} personne{selectedUsers.size > 1 ? "s" : ""} sélectionnée{selectedUsers.size > 1 ? "s" : ""}</div>
                )}
                <div className="border border-gray-100 dark:border-gray-800 rounded-lg max-h-36 overflow-y-auto">
                  {userCandidates.length === 0
                    ? <div className="text-xs text-gray-400 p-2">Aucun résultat</div>
                    : userCandidates.map((u) => {
                        const sel = selectedUsers.has(u.id)
                        return (
                          <button key={u.id} type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                            onClick={() => toggleUser(u.id)}
                          >
                            <div className="w-7 h-7 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs flex-shrink-0">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="flex-1 truncate text-sm">{u.name}</span>
                            <span className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${sel ? "bg-red-600 border-red-600" : "border-gray-300"}`}>
                              {sel && <Check className="w-3.5 h-3.5 text-white" />}
                            </span>
                          </button>
                        )
                      })
                  }
                </div>
              </div>
            )}
          </div>
        )}

        <Button onClick={save} disabled={busy || name.trim().length < 1} className="bg-red-600 hover:bg-red-700 text-white w-full">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
