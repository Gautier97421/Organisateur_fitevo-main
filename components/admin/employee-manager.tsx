"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, UserCheck, UserX, Shield, Users, User, Building2, Loader2, AlertCircle, X, Check, MessageCircle, Save, QrCode } from "lucide-react"
import { supabase, type Employee, type Admin, type Gym } from "@/lib/api-client"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", gymIds: [] as string[], remoteWork: false })
  const [isAddingEmployee, setIsAddingEmployee] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"employees" | "admins">("employees")
  const [whatsappLink, setWhatsappLink] = useState("")
  const [siteUrl, setSiteUrl] = useState("")
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false)
  const [isSavingSiteUrl, setIsSavingSiteUrl] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{
    id: string
    name: string
    type: "employee" | "admin" | "network"
    isSuperAdmin?: boolean
  } | null>(null)

  const loadData = async () => {
    try {
      // Charger les employés
      const { data: employeesData, error: employeesError } = await supabase.from("employees").select("*").order("name")
      if (!employeesError) {
        setEmployees(employeesData || [])
      }

      // Charger les admins
      const { data: adminsData, error: adminsError } = await supabase.from("admins").select("*").order("name")
      if (!adminsError) {
        setAdmins(adminsData || [])
      }

      // Charger les salles
      const { data: gymsData, error: gymsError } = await supabase.from("gyms").select("*").order("name")
      if (!gymsError) {
        setGyms(gymsData || [])
      }

      // Charger le lien WhatsApp
      const { data: whatsappData } = await supabase.from("app_config").select("*").eq("key", "whatsapp_link").single()
      if (whatsappData) {
        setWhatsappLink(whatsappData.value || "")
      }

      // Charger l'URL du site
      const { data: siteUrlData } = await supabase.from("app_config").select("*").eq("key", "site_url").single()
      if (siteUrlData) {
        setSiteUrl(siteUrlData.value || "")
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Vérifier si l'utilisateur est super admin
    const userRole = localStorage.getItem("userRole")
    const isSuperAdminFlag = localStorage.getItem("isSuperAdmin") === "true"
    setIsSuperAdmin(userRole === "superadmin" || isSuperAdminFlag)
  }, [])

  // Désactiver auto-refresh pour améliorer les performances (interval = 0)
  useAutoRefresh(loadData, 0)

  const addEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email) return

    try {
      const { data, error } = await supabase
        .from("employees")
        .insert([
          {
            name: newEmployee.name,
            email: newEmployee.email,
            remote_work_enabled: newEmployee.remoteWork,
          },
        ])

      if (error) throw error

      if (data && data[0] && newEmployee.gymIds.length > 0) {
        // Assigner les salles
        const gymAssignments = newEmployee.gymIds.map((gymId) => ({
          employee_id: data[0].id,
          gym_id: gymId,
        }))

        await supabase.from("employee_gyms").insert(gymAssignments)
      }

      await loadData() // Recharger pour avoir les relations
      setNewEmployee({ name: "", email: "", gymIds: [], remoteWork: false })
      setIsAddingEmployee(false)
      alert("✅ Employé ajouté avec succès !")
    } catch (error) {
      alert("Erreur lors de l'ajout de l'employé")
    }
  }

  const confirmDelete = (id: string, name: string, type: "employee" | "admin") => {
    setSelectedUser({ id, name, type })
    setShowDeleteDialog(true)
  }

  const executeDelete = async () => {
    if (!selectedUser) return

    try {
      let table = ""
      switch (selectedUser.type) {
        case "employee":
          table = "employees"
          break
        case "admin":
          table = "admins"
          break
        case "network":
          table = "allowed_networks"
          break
      }

      const { error } = await supabase.from(table).delete().eq("id", selectedUser.id)
      if (error) throw error

      if (selectedUser.type === "employee") {
        setEmployees(employees.filter((emp) => emp.id !== selectedUser.id))
      } else if (selectedUser.type === "admin") {
        setAdmins(admins.filter((adm) => adm.id !== selectedUser.id))
      }

      setShowDeleteDialog(false)
      setSelectedUser(null)
      alert(
        `✅ ${selectedUser.type === "employee" ? "Employé" : "Administrateur"} supprimé avec succès`,
      )
    } catch (error) {
      alert("Erreur lors de la suppression")
    }
  }

  const confirmStatusChange = (id: string, name: string, type: "employee" | "admin", isSuperAdmin = false) => {
    if (type === "admin" && isSuperAdmin) {
      alert("❌ Impossible de désactiver un Super Administrateur")
      return
    }
    setSelectedUser({ id, name, type, isSuperAdmin })
    setShowStatusDialog(true)
  }

  const executeStatusChange = async () => {
    if (!selectedUser) return

    try {
      const table = selectedUser.type === "employee" ? "employees" : "admins"
      const currentUser =
        selectedUser.type === "employee"
          ? employees.find((emp) => emp.id === selectedUser.id)
          : admins.find((adm) => adm.id === selectedUser.id)

      if (!currentUser) return

      const { error } = await supabase
        .from(table)
        .update({ is_active: !currentUser.is_active })
        .eq("id", selectedUser.id)

      if (error) throw error

      if (selectedUser.type === "employee") {
        setEmployees(employees.map((emp) => (emp.id === selectedUser.id ? { ...emp, is_active: !emp.is_active } : emp)))
      } else {
        setAdmins(admins.map((adm) => (adm.id === selectedUser.id ? { ...adm, is_active: !adm.is_active } : adm)))
      }

      setShowStatusDialog(false)
      setSelectedUser(null)
    } catch (error) {
      alert("Erreur lors de la mise à jour")
    }
  }

  const saveWhatsappLink = async () => {
    setIsSavingWhatsapp(true)
    try {
      const userName = localStorage.getItem("userName") || "Admin"
      
      await supabase
        .from("app_config")
        .update({
          value: whatsappLink,
          updated_by: userName
        })
        .eq("key", "whatsapp_link")

      alert("Lien WhatsApp enregistré avec succès !")
    } catch (error) {
      alert("Erreur lors de la sauvegarde")
    } finally {
      setIsSavingWhatsapp(false)
    }
  }

  const saveSiteUrl = async () => {
    setIsSavingSiteUrl(true)
    try {
      const userName = localStorage.getItem("userName") || "Admin"
      
      // Vérifier si la config existe déjà
      const { data: existing } = await supabase
        .from("app_config")
        .select("*")
        .eq("key", "site_url")
        .single()

      if (existing) {
        await supabase
          .from("app_config")
          .update({
            value: siteUrl,
            updated_by: userName
          })
          .eq("key", "site_url")
      } else {
        await supabase
          .from("app_config")
          .insert({
            key: "site_url",
            value: siteUrl,
            updated_by: userName
          })
      }

      alert("URL du site enregistrée avec succès !")
    } catch (error) {
      alert("Erreur lors de la sauvegarde")
    } finally {
      setIsSavingSiteUrl(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-3 text-sm text-gray-500">Chargement...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <Users className="w-7 h-7 text-gray-700" />
        <h2 className="text-2xl font-semibold text-gray-800">
          Gestion des Utilisateurs
        </h2>
      </div>

      {/* Navigation entre employés et admins */}
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "employees"
              ? "text-red-600 border-b-2 border-red-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Employés</span>
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
            {employees.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("admins")}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "admins"
              ? "text-red-600 border-b-2 border-red-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Administrateurs</span>
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
            {admins.length}
          </span>
        </button>
      </div>

      {/* Section Lien WhatsApp */}
      <Card className="border border-red-200 bg-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-red-600">
              <MessageCircle className="w-5 h-5" />
              <span className="font-medium">Lien du groupe WhatsApp</span>
            </div>
            <div className="flex-1 flex gap-2">
              <Input
                value={whatsappLink}
                onChange={(e) => setWhatsappLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="flex-1 border-gray-300 focus:border-red-600 bg-white"
              />
              <Button
                onClick={saveWhatsappLink}
                disabled={isSavingWhatsapp}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isSavingWhatsapp ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-red-600 mt-2 ml-7">
            Ce lien sera affiché sur l'écran d'accueil des employés pour qu'ils puissent accéder au groupe
          </p>
        </CardContent>
      </Card>

      {/* Section URL du site (Super Admin uniquement) */}
      {isSuperAdmin && (
        <Card className="border border-blue-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-blue-600">
                <QrCode className="w-5 h-5" />
                <span className="font-medium">URL du site (pour QR Codes)</span>
              </div>
              <div className="flex-1 flex gap-2">
                <Input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://votre-site.com"
                  className="flex-1 border-gray-300 focus:border-blue-600 bg-white"
                />
                <Button
                  onClick={saveSiteUrl}
                  disabled={isSavingSiteUrl}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSavingSiteUrl ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2 ml-7">
              Cette URL sera utilisée pour générer tous les QR Codes des salles (pour le pointage des employés)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Section Employés */}
      {activeTab === "employees" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => setIsAddingEmployee(!isAddingEmployee)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un employé
            </Button>
          </div>

          {isAddingEmployee && (
            <Card className="border border-gray-200 bg-white">
              <CardHeader className="border-b border-gray-200 bg-gray-50">
                <CardTitle className="text-lg font-medium text-gray-900">Nouvel employé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emp-name">Nom complet</Label>
                    <Input
                      id="emp-name"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      placeholder="Nom de l'employé"
                      className="border border-gray-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emp-email">Email</Label>
                    <Input
                      id="emp-email"
                      type="email"
                      value={newEmployee.email}
                      onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                      placeholder="email@salle.com"
                      className="border border-gray-300"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Salles assignées</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {gyms.map((gym) => (
                      <div key={gym.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`gym-${gym.id}`}
                          checked={newEmployee.gymIds.includes(gym.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewEmployee({
                                ...newEmployee,
                                gymIds: [...newEmployee.gymIds, gym.id],
                              })
                            } else {
                              setNewEmployee({
                                ...newEmployee,
                                gymIds: newEmployee.gymIds.filter((id) => id !== gym.id),
                              })
                            }
                          }}
                        />
                        <Label htmlFor={`gym-${gym.id}`} className="text-sm text-gray-700">
                          {gym.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded">
                  <Checkbox
                    id="remote-work"
                    checked={newEmployee.remoteWork}
                    onCheckedChange={(checked) => setNewEmployee({ ...newEmployee, remoteWork: checked as boolean })}
                  />
                  <Label htmlFor="remote-work" className="text-sm text-gray-700">
                    Télétravail autorisé (pas de restriction réseau)
                  </Label>
                </div>

                <div className="flex space-x-2">
                  <Button onClick={addEmployee} className="bg-red-600 hover:bg-red-700">
                    <Check className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingEmployee(false)}
                    className="border border-gray-300 hover:bg-gray-50"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {employees.length === 0 ? (
              <Card className="border border-dashed border-gray-300 bg-white">
                <CardContent className="p-12 text-center">
                  <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500">Aucun employé</p>
                  <p className="text-xs text-gray-400 mt-1">Ajoutez votre premier employé</p>
                </CardContent>
              </Card>
            ) : (
              employees.map((employee) => (
                <Card key={employee.id} className="border border-gray-200 bg-white hover:border-gray-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm text-gray-900">{employee.name}</h3>
                          <p className="text-xs text-gray-500">{employee.email}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant={employee.is_active ? "default" : "secondary"} className="text-xs px-2 py-0">
                              {employee.is_active ? "Actif" : "Inactif"}
                            </Badge>
                            {employee.remote_work_enabled && (
                              <Badge className="bg-gray-100 text-gray-600 text-xs px-2 py-0">
                                Télétravail
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmStatusChange(employee.id, employee.name, "employee")}
                        >
                          {employee.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDelete(employee.id, employee.name, "employee")}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Section Admins */}
      {activeTab === "admins" && (
        <div className="space-y-6">

          <div className="grid gap-4">
            {admins.length === 0 ? (
              <Card className="border border-dashed border-gray-300 bg-white">
                <CardContent className="p-12 text-center">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500">Aucun administrateur</p>
                </CardContent>
              </Card>
            ) : (
              admins.map((admin) => (
                <Card key={admin.id} className="border border-gray-200 bg-white hover:border-gray-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            admin.is_super_admin
                              ? "bg-red-100"
                              : "bg-red-100"
                          }`}
                        >
                          <Shield className={`h-5 w-5 ${
                            admin.is_super_admin
                              ? "text-red-600"
                              : "text-red-600"
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-sm text-gray-900">{admin.name}</h3>
                            {admin.is_super_admin && (
                              <Badge className="bg-red-100 text-red-700 text-xs px-2 py-0">
                                Super Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{admin.email}</p>
                          <Badge variant={admin.is_active ? "default" : "secondary"} className="text-xs px-2 py-0 mt-1">
                            {admin.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmStatusChange(admin.id, admin.name, "admin", admin.is_super_admin)}
                          disabled={admin.is_super_admin && admin.is_active}
                        >
                          {admin.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDelete(admin.id, admin.name, "admin")}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Dialog de confirmation de suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <Trash2 className="h-6 w-6 text-red-600" />
              <span>Confirmer la suppression</span>
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
              Êtes-vous sûr de vouloir supprimer <strong>{selectedUser?.name}</strong> ?
              <br />
              <span className="text-red-600 font-medium">Cette action est irréversible.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="border border-gray-300 hover:bg-gray-50"
            >
              <X className="mr-2 h-4 w-4" />
              Annuler
            </Button>
            <Button onClick={executeDelete} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de changement de statut */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <UserCheck className="h-6 w-6 text-red-600" />
              <span>Confirmer le changement de statut</span>
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
              {selectedUser && (
                <>
                  Voulez-vous{" "}
                  {(
                    selectedUser.type === "employee"
                      ? employees.find((e) => e.id === selectedUser.id)?.is_active
                      : admins.find((a) => a.id === selectedUser.id)?.is_active
                  )
                    ? "désactiver"
                    : "activer"}{" "}
                  le compte de <strong>{selectedUser.name}</strong> ?
                  <br />
                  {(selectedUser.type === "employee"
                    ? employees.find((e) => e.id === selectedUser.id)?.is_active
                    : admins.find((a) => a.id === selectedUser.id)?.is_active) && (
                    <span className="text-amber-600 font-medium">
                      L'utilisateur ne pourra plus se connecter.
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(false)}
              className="border border-gray-300 hover:bg-gray-50"
            >
              <X className="mr-2 h-4 w-4" />
              Annuler
            </Button>
            <Button onClick={executeStatusChange} className="bg-red-600 hover:bg-red-700">
              <Check className="mr-2 h-4 w-4" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
