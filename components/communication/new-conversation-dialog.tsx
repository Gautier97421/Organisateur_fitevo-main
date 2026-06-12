"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Check, Users, MessageSquare, Loader2 } from "lucide-react"
import type { DirectoryUser } from "./types"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserRole: string
  onCreated: (conversationId: string) => void
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: Props) {
  const [mode, setMode] = useState<"direct" | "group">("direct")
  const [search, setSearch] = useState("")
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [groupName, setGroupName] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/communication/directory?q=${encodeURIComponent(search)}`)
      if (!cancelled && res.ok) {
        const json = await res.json()
        setUsers(json.data || [])
      }
      if (!cancelled) setLoading(false)
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search, open])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createDirect = async (userId: string) => {
    setCreating(true)
    const res = await fetch("/api/communication/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "direct", userId }),
    })
    setCreating(false)
    if (res.ok) {
      const json = await res.json()
      onCreated(json.data.id)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || "Erreur")
    }
  }

  const createGroup = async () => {
    if (groupName.trim().length < 1) { toast.error("Nom de groupe requis"); return }
    if (selected.size < 1) { toast.error("Sélectionnez au moins un membre"); return }
    setCreating(true)
    const res = await fetch("/api/communication/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "group", name: groupName.trim(), memberIds: [...selected] }),
    })
    setCreating(false)
    if (res.ok) {
      const json = await res.json()
      onCreated(json.data.id)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || "Erreur")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={mode === "direct" ? "default" : "outline"}
            size="sm"
            className={mode === "direct" ? "bg-red-600 hover:bg-red-700 text-white flex-1" : "flex-1"}
            onClick={() => setMode("direct")}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Direct
          </Button>
          <Button
            variant={mode === "group" ? "default" : "outline"}
            size="sm"
            className={mode === "group" ? "bg-red-600 hover:bg-red-700 text-white flex-1" : "flex-1"}
            onClick={() => setMode("group")}
          >
            <Users className="w-4 h-4 mr-2" /> Groupe
          </Button>
        </div>

        {mode === "group" && (
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nom du groupe"
            maxLength={100}
          />
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur..."
            className="pl-8"
          />
        </div>

        <ScrollArea className="flex-1 min-h-[200px] max-h-[40vh] border border-gray-100 dark:border-gray-800 rounded">
          {loading ? (
            <div className="p-4 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">Aucun utilisateur</div>
          ) : (
            <ul>
              {users.map((u) => {
                const isSel = selected.has(u.id)
                return (
                  <li key={u.id}>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                      onClick={() => (mode === "direct" ? createDirect(u.id) : toggle(u.id))}
                      disabled={creating}
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-500 text-white flex items-center justify-center text-sm">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{u.name}</div>
                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      </div>
                      {mode === "group" && (
                        <span
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            isSel ? "bg-red-600 border-red-600" : "border-gray-300"
                          }`}
                        >
                          {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        {mode === "group" && (
          <Button
            onClick={createGroup}
            disabled={creating}
            className="bg-red-600 hover:bg-red-700 text-white w-full"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : `Créer le groupe (${selected.size})`}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
