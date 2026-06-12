"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Check, UserPlus, LogOut, Trash2, Loader2, Pencil, Shield, ShieldOff } from "lucide-react"
import type { Conversation, DirectoryUser } from "./types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: Conversation
  currentUser: { id: string; name: string; role: string }
  canManage: boolean
  onChanged: () => void
}

export function GroupSettingsDialog({ open, onOpenChange, conversation, currentUser, canManage, onChanged }: Props) {
  const [name, setName] = useState(conversation.name || "")
  const [editingName, setEditingName] = useState(false)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")
  const [candidates, setCandidates] = useState<DirectoryUser[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const memberIds = new Set(conversation.members.map((m) => m.userId))

  useEffect(() => {
    if (!adding) return
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await fetch(`/api/communication/directory?q=${encodeURIComponent(search)}`)
      if (!cancelled && res.ok) {
        const json = await res.json()
        setCandidates((json.data || []).filter((u: DirectoryUser) => !memberIds.has(u.id)))
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, adding])

  const saveName = async () => {
    if (name.trim().length < 1) return
    setBusy(true)
    const res = await fetch(`/api/communication/conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })
    setBusy(false)
    if (res.ok) { setEditingName(false); onChanged() }
    else alert("Erreur lors du renommage")
  }

  const addMembers = async () => {
    if (selected.size === 0) return
    setBusy(true)
    const res = await fetch(`/api/communication/conversations/${conversation.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: [...selected] }),
    })
    setBusy(false)
    if (res.ok) { setSelected(new Set()); setAdding(false); setSearch(""); onChanged() }
    else alert("Erreur lors de l'ajout")
  }

  const setRole = async (userId: string, role: "admin" | "member") => {
    setBusy(true)
    const res = await fetch(`/api/communication/conversations/${conversation.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    })
    setBusy(false)
    if (res.ok) onChanged()
    else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Erreur lors du changement de rôle")
    }
  }

  const removeMember = async (userId: string) => {
    setBusy(true)
    const res = await fetch(`/api/communication/conversations/${conversation.id}/members?userId=${userId}`, {
      method: "DELETE",
    })
    setBusy(false)
    if (res.ok) onChanged()
    else alert("Erreur lors du retrait")
  }

  const leave = async () => {
    if (!confirm("Quitter ce groupe ?")) return
    setBusy(true)
    const res = await fetch(`/api/communication/conversations/${conversation.id}/members?userId=${currentUser.id}`, {
      method: "DELETE",
    })
    setBusy(false)
    if (res.ok) { onOpenChange(false); onChanged() }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Paramètres du groupe</DialogTitle>
        </DialogHeader>

        {/* Nom */}
        <div className="flex items-center gap-2">
          {editingName && canManage ? (
            <>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="flex-1" />
              <Button size="sm" onClick={saveName} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 font-semibold text-gray-900 dark:text-white">{conversation.name}</span>
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>

        {/* Ajout de membres */}
        {canManage && (
          <div>
            <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)} className="w-full">
              <UserPlus className="w-4 h-4 mr-2" /> {adding ? "Annuler l'ajout" : "Ajouter des membres"}
            </Button>
            {adding && (
              <div className="mt-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-8" />
                </div>
                <ScrollArea className="max-h-40 border border-gray-100 dark:border-gray-800 rounded">
                  {candidates.map((u) => {
                    const isSel = selected.has(u.id)
                    return (
                      <button
                        key={u.id}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                        onClick={() =>
                          setSelected((prev) => {
                            const n = new Set(prev)
                            n.has(u.id) ? n.delete(u.id) : n.add(u.id)
                            return n
                          })
                        }
                      >
                        <span className="flex-1 truncate text-sm">{u.name}</span>
                        <span className={`w-5 h-5 rounded border flex items-center justify-center ${isSel ? "bg-red-600 border-red-600" : "border-gray-300"}`}>
                          {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                      </button>
                    )
                  })}
                </ScrollArea>
                <Button size="sm" onClick={addMembers} disabled={busy || selected.size === 0} className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Ajouter ({selected.size})
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Liste des membres */}
        <div className="flex-1 min-h-0">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Membres ({conversation.members.length})
          </div>
          <ScrollArea className="max-h-52 border border-gray-100 dark:border-gray-800 rounded">
            <ul>
              {conversation.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-gray-500 text-white flex items-center justify-center text-xs">
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 dark:text-white truncate">
                      {m.name} {m.userId === currentUser.id && "(vous)"}
                    </div>
                    {m.role === "admin" && <div className="text-xs text-red-600">Admin du groupe</div>}
                  </div>
                  {canManage && m.userId !== currentUser.id && (
                    <>
                      {m.role === "admin" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRole(m.userId, "member")}
                          disabled={busy}
                          title="Retirer le rôle admin"
                          className="text-red-600 hover:text-gray-600 px-2"
                        >
                          <ShieldOff className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRole(m.userId, "admin")}
                          disabled={busy}
                          title="Nommer admin du groupe"
                          className="text-gray-400 hover:text-red-600 px-2"
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeMember(m.userId)} disabled={busy} className="text-gray-400 hover:text-red-600 px-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <Button variant="outline" onClick={leave} disabled={busy} className="text-red-600 border-red-200 hover:bg-red-50">
          <LogOut className="w-4 h-4 mr-2" /> Quitter le groupe
        </Button>
      </DialogContent>
    </Dialog>
  )
}
