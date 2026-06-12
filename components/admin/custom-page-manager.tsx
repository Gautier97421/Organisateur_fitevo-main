"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { Save, Loader2, Plus, Trash2, Check, X, Edit, LayoutDashboard, Eye, EyeOff, Users, Shield } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { getUserEmail } from "@/lib/current-user"

interface Role {
  id: string
  name: string
  color: string
}

interface CustomPage {
  id: string
  title: string
  icon: string
  description: string | null
  orderIndex: number
  isActive: boolean
  roleIds: string[] | null
  createdBy: string
  items?: Array<{
    id: number
    title: string
    description: string | null
    orderIndex: number
    isActive: boolean
  }>
}

// Prisma renvoie les champs Json? en tableau, string JSON, ou null selon le contexte
function parseRoleIds(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string")
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
    } catch { return [] }
  }
  return []
}

export function CustomPageManager() {
  const [pages, setPages] = useState<CustomPage[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showRolesDialog, setShowRolesDialog] = useState<string | null>(null)
  // State local du dialog de rôles — ne sauvegarde qu'au clic "Enregistrer"
  const [dialogRoleIds, setDialogRoleIds] = useState<string[]>([])

  // Form fields
  const [formTitle, setFormTitle] = useState("")
  const [formIcon, setFormIcon] = useState("FileText")
  const [formDescription, setFormDescription] = useState("")
  const [formRoleIds, setFormRoleIds] = useState<string[]>([])

  const loadPages = async () => {
    try {
      // Charger toutes les pages, y compris les inactives pour les superadmins
      const response = await fetch("/api/custom-pages?includeInactive=true")
      if (response.ok) {
        const result = await response.json()
        setPages(result.data || [])
      }
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await fetch("/api/db/roles?orderBy=name")
      if (response.ok) {
        const result = await response.json()
        const rolesData = Array.isArray(result.data) ? result.data : []
        setRoles(rolesData)
      }
    } catch (error) {
    }
  }

  useEffect(() => {
    loadPages()
    loadRoles()
  }, [])

  useAutoRefresh(loadPages, 30000)

  const resetForm = () => {
    setFormTitle("")
    setFormIcon("FileText")
    setFormDescription("")
    setFormRoleIds([])
    setEditingId(null)
    setShowAddForm(false)
  }

  const handleAdd = async () => {
    if (!formTitle.trim()) return
    
    setIsSaving(true)
    try {
      const userEmail = getUserEmail() || "unknown"
      
      const response = await fetch("/api/custom-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          icon: formIcon,
          description: formDescription || null,
          roleIds: formRoleIds.length > 0 ? formRoleIds : null,
          createdBy: userEmail
        })
      })

      if (response.ok) {
        resetForm()
        await loadPages()
      }
    } catch (error) {
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (page: CustomPage) => {
    setEditingId(page.id)
    setFormTitle(page.title)
    setFormIcon(page.icon)
    setFormDescription(page.description || "")
    setFormRoleIds(parseRoleIds(page.roleIds))
    setShowAddForm(true)
  }

  const handleUpdate = async () => {
    if (!editingId || !formTitle.trim()) return
    
    setIsSaving(true)
    try {
      const response = await fetch(`/api/custom-pages?id=${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          icon: formIcon,
          description: formDescription || null,
          roleIds: formRoleIds.length > 0 ? formRoleIds : null
        })
      })

      if (response.ok) {
        resetForm()
        await loadPages()
      }
    } catch (error) {
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateRoles = async () => {
    if (!showRolesDialog) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/custom-pages?id=${showRolesDialog}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleIds: dialogRoleIds.length > 0 ? dialogRoleIds : null
        })
      })

      if (response.ok) {
        await loadPages()
        setShowRolesDialog(null)
      }
    } catch (error) {
    } finally {
      setIsSaving(false)
    }
  }

  const openRolesDialog = (pageId: string) => {
    const page = pages.find(p => p.id === pageId)
    setDialogRoleIds(parseRoleIds(page?.roleIds))
    setShowRolesDialog(pageId)
  }

  const toggleDialogRole = (roleId: string) => {
    setDialogRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    )
  }

  const toggleRoleInForm = (roleId: string) => {
    setFormRoleIds(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    )
  }

  const getRoleById = (roleId: string) => roles.find(r => r.id === roleId)

  const getRoleColor = (color: string) => {
    const colors: Record<string, string> = {
      rouge: "bg-red-100 text-red-700 border-red-300",
      bleu: "bg-blue-100 text-blue-700 border-blue-300",
      vert: "bg-green-100 text-green-700 border-green-300",
      jaune: "bg-yellow-100 text-yellow-700 border-yellow-300",
      orange: "bg-orange-100 text-orange-700 border-orange-300",
      mauve: "bg-purple-100 text-purple-700 border-purple-300"
    }
    return colors[color] || "bg-gray-100 text-gray-700 border-gray-300"
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/custom-pages?id=${deleteConfirmId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        await loadPages()
      }
    } catch (error) {
    } finally {
      setIsSaving(false)
      setDeleteConfirmId(null)
    }
  }

  const handleToggleActive = async (page: CustomPage) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/custom-pages?id=${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !page.isActive })
      })

      if (response.ok) {
        await loadPages()
      }
    } catch (error) {
    } finally {
      setIsSaving(false)
    }
  }

  // Liste d'icônes courantes
  const commonIcons = [
    "FileText", "UserPlus", "Users", "Calendar", "ClipboardList", 
    "Lock", "Unlock", "Settings", "Star", "Heart", "Home",
    "Bell", "Mail", "Phone", "MessageSquare", "Package",
    "ShoppingCart", "CreditCard", "DollarSign", "TrendingUp", "BarChart"
  ]

  if (isLoading) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="border-b border-gray-200 bg-gray-50 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-semibold text-gray-900">
            <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
            Gestion des Pages Personnalisées
          </CardTitle>
          <Button
            onClick={() => {
              resetForm()
              setShowAddForm(!showAddForm)
            }}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une page
          </Button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Créez des pages personnalisées qui apparaîtront comme des onglets dans le panneau d'administration. Les admins pourront ensuite les utiliser pour gérer diverses procédures.
        </p>
      </CardHeader>
      <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
        {/* Formulaire d'ajout/édition */}
        {showAddForm && (
          <Card className="border-2 border-red-200 bg-white">
            <CardContent className="p-3 md:p-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="formTitle" className="text-sm font-medium text-gray-700">
                  Titre de la page *
                </Label>
                <Input
                  id="formTitle"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Nouveau Adhérent, Procédure Fermeture..."
                  className="border-gray-300 focus:border-red-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="formIcon" className="text-sm font-medium text-gray-700">
                  Icône *
                </Label>
                <Select value={formIcon} onValueChange={setFormIcon}>
                  <SelectTrigger className="border-gray-300 focus:border-red-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commonIcons.map((iconName) => {
                      const IconComponent = (LucideIcons as any)[iconName]
                      return (
                        <SelectItem key={iconName} value={iconName}>
                          <div className="flex items-center gap-2">
                            {IconComponent && <IconComponent className="w-4 h-4" />}
                            {iconName}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="formDescription" className="text-sm font-medium text-gray-700">
                  Description (optionnelle)
                </Label>
                <Textarea
                  id="formDescription"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Description de la page..."
                  className="border-gray-300 focus:border-red-600 min-h-[60px]"
                />
              </div>

              {/* Sélecteur de rôles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Rôles autorisés
                </Label>
                <p className="text-xs text-gray-500 mb-2">
                  Sélectionnez les rôles qui peuvent voir cette page. Laissez vide pour que tous les employés y aient accès.
                </p>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {roles.length === 0 ? (
                    <span className="text-sm text-gray-500 italic">Aucun rôle créé</span>
                  ) : (
                    roles.map(role => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleRoleInForm(role.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                          formRoleIds.includes(role.id)
                            ? getRoleColor(role.color) + " ring-2 ring-offset-1 ring-gray-400"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        {formRoleIds.includes(role.id) && <Check className="w-3 h-3 inline mr-1" />}
                        {role.name}
                      </button>
                    ))
                  )}
                </div>
                {formRoleIds.length === 0 && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Accessible à tous les employés
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={editingId ? handleUpdate : handleAdd}
                  disabled={isSaving || !formTitle.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white flex-1"
                  size="sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingId ? "Mise à jour..." : "Ajout..."}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {editingId ? "Mettre à jour" : "Ajouter"}
                    </>
                  )}
                </Button>
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="border-gray-300 bg-white hover:bg-gray-50"
                  size="sm"
                >
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liste des pages */}
        <div className="space-y-2">
          {!Array.isArray(pages) || pages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune page personnalisée créée. Cliquez sur "Ajouter une page" pour commencer.
            </div>
          ) : (
            pages.map((page) => {
              const IconComponent = (LucideIcons as any)[page.icon]
              const itemCount = (page as any).items?.length || 0
              const pageRoleIds = parseRoleIds(page.roleIds)
              return (
                <Card key={page.id} className={`border ${page.isActive ? 'border-gray-200' : 'border-gray-300 bg-gray-100 opacity-60'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {IconComponent && (
                          <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${page.isActive ? 'text-red-600' : 'text-gray-400'}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold ${page.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                            {page.title}
                            {!page.isActive && <span className="ml-2 text-xs text-gray-500">(Désactivée)</span>}
                          </h3>
                          {page.description && (
                            <p className="text-sm text-gray-600 mt-1">{page.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2 text-xs">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              📋 {itemCount} étape{itemCount !== 1 ? 's' : ''}
                            </span>
                            {/* Affichage des rôles autorisés */}
                            {pageRoleIds.length === 0 ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded flex items-center gap-1">
                                <Users className="w-3 h-3" /> Tous les employés
                              </span>
                            ) : (
                              pageRoleIds.map(roleId => {
                                const role = getRoleById(roleId)
                                if (!role) return null
                                return (
                                  <span key={roleId} className={`px-2 py-1 rounded ${getRoleColor(role.color)}`}>
                                    {role.name}
                                  </span>
                                )
                              })
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {/* Bouton pour modifier les rôles */}
                        <Button
                          onClick={() => openRolesDialog(page.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          title="Gérer les accès"
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleEdit(page)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleToggleActive(page)}
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 ${page.isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                          title={page.isActive ? "Désactiver la page" : "Activer la page"}
                        >
                          {page.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          onClick={() => setDeleteConfirmId(page.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Dialog de confirmation de suppression */}
        <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer cette page ? Tous ses éléments seront également supprimés. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de gestion des rôles */}
        <Dialog open={showRolesDialog !== null} onOpenChange={(open) => !open && setShowRolesDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Gérer les accès
              </DialogTitle>
              <DialogDescription>
                Cochez les rôles qui peuvent voir cette page. Laissez tout décoché pour que tous les employés y aient accès.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[80px]">
                {roles.length === 0 ? (
                  <span className="text-sm text-gray-500 italic">Aucun rôle créé. Créez des rôles dans l'onglet "Utilisateurs".</span>
                ) : (
                  roles.map(role => {
                    const isSelected = dialogRoleIds.includes(role.id)
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleDialogRole(role.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          isSelected
                            ? getRoleColor(role.color) + " ring-2 ring-offset-1 ring-gray-400"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                        {role.name}
                      </button>
                    )
                  })
                )}
              </div>
              {dialogRoleIds.length === 0 ? (
                <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
                  <Users className="w-4 h-4" />
                  Accessible à tous les employés
                </p>
              ) : (
                <p className="text-sm text-purple-600 flex items-center gap-1 mt-2">
                  <Shield className="w-4 h-4" />
                  Accessible uniquement aux {dialogRoleIds.length} rôle{dialogRoleIds.length > 1 ? 's' : ''} sélectionné{dialogRoleIds.length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRolesDialog(null)}
                disabled={isSaving}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleUpdateRoles}
                disabled={isSaving}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Enregistrer</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
