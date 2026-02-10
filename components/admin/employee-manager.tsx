"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, UserCheck, UserX, Shield, Users, User, Building2, Loader2, AlertCircle, X, Check, MessageCircle, Save, QrCode, CheckCircle, XCircle, Pencil } from "lucide-react"
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

// Couleurs prédéfinies pour les rôles
const ROLE_COLORS = [
  { name: "Rouge", value: "rouge", hex: "#ef4444" },
  { name: "Bleu", value: "bleu", hex: "#3b82f6" },
  { name: "Orange", value: "orange", hex: "#f97316" },
  { name: "Jaune", value: "jaune", hex: "#eab308" },
  { name: "Noir", value: "noir", hex: "#1f2937" },
  { name: "Mauve", value: "mauve", hex: "#a855f7" },
]

interface Role {
  id: string
  name: string
  color: string
}

export function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [newEmployee, setNewEmployee] = useState({ 
    name: "", 
    email: "", 
    gymIds: [] as string[], 
    remoteWork: false, 
    roleId: "",
    newRoleName: "",
    newRoleColor: "bleu",
    hasCalendarAccess: true,
    hasEventProposalAccess: true,
    hasWorkScheduleAccess: true,
    hasWorkPeriodAccess: true
  })
  const [isAddingEmployee, setIsAddingEmployee] = useState(false)
  const [isEditingEmployee, setIsEditingEmployee] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: boolean}>({})
  const [editValidationErrors, setEditValidationErrors] = useState<{[key: string]: boolean}>({})
  
  // Refs pour le scroll automatique
  const nameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const roleSelectRef = useRef<HTMLButtonElement>(null)
  const editNameInputRef = useRef<HTMLInputElement>(null)
  const editRoleSelectRef = useRef<HTMLButtonElement>(null)
  const [editEmployee, setEditEmployee] = useState<{ 
    id: string; 
    name: string; 
    email: string; 
    gymIds: string[]; 
    remoteWork: boolean;
    roleId: string;
    newRoleName: string;
    newRoleColor: string;
    hasCalendarAccess: boolean;
    hasEventProposalAccess: boolean;
    hasWorkScheduleAccess: boolean;
    hasWorkPeriodAccess: boolean;
  } | null>(null)
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
      if (!employeesError && employeesData) {
        // Charger les salles assignées pour chaque employé
        const employeesWithGyms = await Promise.all(
          employeesData.map(async (emp) => {
            const response = await fetch(`/api/employee-gyms?employeeId=${emp.id}`)
            if (response.ok) {
              const { data: gymsData } = await response.json()
              return {
                ...emp,
                gym_ids: gymsData?.map((g: any) => g.id) || [],
                gyms: gymsData || []
              }
            }
            return emp
          })
        )
        setEmployees(employeesWithGyms)
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

      // Charger les rôles
      await loadRoles()
    } finally {
      setIsLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await fetch("/api/roles")
      if (response.ok) {
        const { data } = await response.json()
        setRoles(data || [])
      }
    } catch (error) {
      console.error("Erreur lors du chargement des rôles:", error)
    }
  }

  useEffect(() => {
    loadData()
    // Vérifier si l'utilisateur est super admin
    const userRole = localStorage.getItem("userRole")
    const isSuperAdminFlag = localStorage.getItem("isSuperAdmin") === "true"
    setIsSuperAdmin(userRole === "superadmin" || isSuperAdminFlag)
  }, [])

  // Rafraîchissement automatique toutes les 15 secondes
  useAutoRefresh(loadData, 15000)

  const addEmployee = async () => {
    // Validation des champs obligatoires
    const errors: {[key: string]: boolean} = {}
    if (!newEmployee.name) errors.name = true
    if (!newEmployee.email) errors.email = true
    if (!newEmployee.roleId) errors.roleId = true
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      // Scroll vers le premier champ en erreur
      if (errors.name && nameInputRef.current) {
        nameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        nameInputRef.current.focus()
      } else if (errors.email && emailInputRef.current) {
        emailInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        emailInputRef.current.focus()
      } else if (errors.roleId && roleSelectRef.current) {
        roleSelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        roleSelectRef.current.focus()
      }
      return
    }
    
    // Reset les erreurs
    setValidationErrors({})

    try {
      // Gérer le rôle (existant ou nouveau)
      let roleId = newEmployee.roleId
      let roleName = ""
      let roleColor = ""

      if (roleId === "new" && newEmployee.newRoleName) {
        // Créer un nouveau rôle
        const colorHex = ROLE_COLORS.find(c => c.value === newEmployee.newRoleColor)?.hex || "#3b82f6"
        const roleResponse = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newEmployee.newRoleName,
            color: colorHex
          })
        })
        if (roleResponse.ok) {
          const roleResult = await roleResponse.json()
          roleId = roleResult.data.id
          roleName = roleResult.data.name
          roleColor = roleResult.data.color
          await loadRoles()
        }
      } else if (roleId && roleId !== "new") {
        const selectedRole = roles.find(r => r.id === roleId)
        roleName = selectedRole?.name || ""
        roleColor = selectedRole?.color || ""
      }

      const response = await fetch('/api/db/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            name: newEmployee.name,
            email: newEmployee.email,
            password: 'temppass123', // Mot de passe temporaire
            role: 'employee',
            remote_work_enabled: newEmployee.remoteWork,
            role_id: roleId && roleId !== "new" ? roleId : null,
            has_calendar_access: newEmployee.hasCalendarAccess,
            has_event_proposal_access: newEmployee.hasEventProposalAccess,
            has_work_schedule_access: newEmployee.hasWorkScheduleAccess,
            has_work_period_access: newEmployee.hasWorkPeriodAccess,
            active: true
          }
        })
      })

      if (!response.ok) throw new Error('Erreur lors de l\'ajout')

      const result = await response.json()
      
      // Gérer les assignations de salles
      if (result.data && newEmployee.gymIds.length > 0) {
        await fetch('/api/employee-gyms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeEmail: newEmployee.email,
            gymIds: newEmployee.gymIds
          })
        })
      }

      await loadData() // Recharger pour avoir les relations
      setNewEmployee({ 
        name: "", 
        email: "", 
        gymIds: [], 
        remoteWork: false,
        roleId: "",
        newRoleName: "",
        newRoleColor: "bleu",
        hasCalendarAccess: true,
        hasEventProposalAccess: true,
        hasWorkScheduleAccess: true,
        hasWorkPeriodAccess: true
      })
      setIsAddingEmployee(false)
      alert("Employé ajouté avec succès !")
    } catch (error) {
      alert("Erreur lors de l'ajout de l'employé")
    }
  }

  const openEditEmployee = (employee: Employee) => {
    // Trouver le roleId à partir du role_id ou employee_role
    let roleId = employee.role_id || ""
    
    // Si employee_role est un objet (relation chargée), utiliser son id
    if (employee.employee_role && typeof employee.employee_role === 'object') {
      roleId = employee.employee_role.id
    }

    setEditEmployee({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      gymIds: employee.gym_ids || [],
      remoteWork: employee.remote_work_enabled || false,
      roleId: roleId,
      newRoleName: "",
      newRoleColor: "bleu",
      hasCalendarAccess: employee.has_calendar_access !== false,
      hasEventProposalAccess: employee.has_event_proposal_access !== false,
      hasWorkScheduleAccess: employee.has_work_schedule_access !== false,
      hasWorkPeriodAccess: employee.has_work_period_access !== false
    })
    setIsEditingEmployee(true)
  }

  const saveEditEmployee = async () => {
    if (!editEmployee) return
    
    // Validation des champs obligatoires
    const errors: {[key: string]: boolean} = {}
    if (!editEmployee.name) errors.name = true
    if (!editEmployee.roleId) errors.roleId = true
    
    if (Object.keys(errors).length > 0) {
      setEditValidationErrors(errors)
      // Scroll vers le premier champ en erreur
      if (errors.name && editNameInputRef.current) {
        editNameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        editNameInputRef.current.focus()
      } else if (errors.roleId && editRoleSelectRef.current) {
        editRoleSelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        editRoleSelectRef.current.focus()
      }
      return
    }
    
    // Reset les erreurs
    setEditValidationErrors({})
    
    try {
      // Gérer le rôle (existant ou nouveau)
      let roleId = editEmployee.roleId
      let roleName = ""
      let roleColor = ""

      if (roleId === "new" && editEmployee.newRoleName) {
        // Créer un nouveau rôle
        const colorHex = ROLE_COLORS.find(c => c.value === editEmployee.newRoleColor)?.hex || "#3b82f6"
        const roleResponse = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editEmployee.newRoleName,
            color: colorHex
          })
        })
        if (roleResponse.ok) {
          const roleResult = await roleResponse.json()
          roleId = roleResult.data.id
          roleName = roleResult.data.name
          roleColor = roleResult.data.color
          await loadRoles()
        }
      } else if (roleId && roleId !== "new") {
        const selectedRole = roles.find(r => r.id === roleId)
        roleName = selectedRole?.name || ""
        roleColor = selectedRole?.color || ""
      }

      // Mettre à jour les informations de base de l'employé
      const response = await fetch(`/api/db/users/${editEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editEmployee.name,
          remote_work_enabled: editEmployee.remoteWork,
          role_id: roleId && roleId !== "new" ? roleId : null,
          has_calendar_access: editEmployee.hasCalendarAccess,
          has_event_proposal_access: editEmployee.hasEventProposalAccess,
          has_work_schedule_access: editEmployee.hasWorkScheduleAccess,
          has_work_period_access: editEmployee.hasWorkPeriodAccess
        })
      })

      if (!response.ok) throw new Error('Erreur lors de la modification')

      // Mettre à jour les salles assignées
      await fetch('/api/employee-gyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: editEmployee.id,
          gymIds: editEmployee.gymIds
        })
      })

      await loadData()
      setIsEditingEmployee(false)
      setEditEmployee(null)
      alert("Employé modifié avec succès !")
    } catch (error) {
      alert("Erreur lors de la modification de l'employé")
    }
  }

  const confirmDelete = (id: string, name: string, type: "employee" | "admin") => {
    setSelectedUser({ id, name, type })
    setShowDeleteDialog(true)
  }

  const executeDelete = async () => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/db/users/${selectedUser.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erreur lors de la suppression')

      if (selectedUser.type === "employee") {
        setEmployees(employees.filter((emp) => emp.id !== selectedUser.id))
      } else if (selectedUser.type === "admin") {
        setAdmins(admins.filter((adm) => adm.id !== selectedUser.id))
      }

      setShowDeleteDialog(false)
      setSelectedUser(null)
      alert(
        `${selectedUser.type === "employee" ? "Employé" : "Administrateur"} supprimé avec succès`,
      )
    } catch (error) {
      alert("Erreur lors de la suppression")
    }
  }

  const confirmStatusChange = (id: string, name: string, type: "employee" | "admin", isSuperAdmin = false) => {
    if (type === "admin" && isSuperAdmin) {
      alert("Impossible de désactiver un Super Administrateur")
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
    <div className="space-y-6 md:space-y-8 px-2 md:px-0">
      <div className="flex items-center space-x-2 md:space-x-3">
        <Users className="w-6 h-6 md:w-7 md:h-7 text-gray-700" />
        <h2 className="text-xl md:text-2xl font-semibold text-gray-800">
          Gestion des Utilisateurs
        </h2>
      </div>

      {/* Navigation entre employés et admins */}
      <div className="flex space-x-1 md:space-x-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
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
          className={`flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
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
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2 text-red-600">
              <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base font-medium">Lien du groupe WhatsApp</span>
            </div>
            <div className="flex-1 w-full flex flex-col sm:flex-row gap-2">
              <Input
                value={whatsappLink}
                onChange={(e) => setWhatsappLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="flex-1 border-gray-300 focus:border-red-600 bg-white text-sm md:text-base"
              />
              <Button
                onClick={saveWhatsappLink}
                disabled={isSavingWhatsapp}
                className="bg-red-600 hover:bg-red-700 text-white text-sm md:text-base w-full sm:w-auto"
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
          <p className="text-xs text-red-600 mt-2 ml-0 md:ml-7">
            Ce lien sera affiché sur l'écran d'accueil des employés pour qu'ils puissent accéder au groupe
          </p>
        </CardContent>
      </Card>

      {/* Section URL du site (Super Admin uniquement) */}
      {isSuperAdmin && (
        <Card className="border border-blue-200 bg-white">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2 text-blue-600">
                <QrCode className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm md:text-base font-medium">URL du site (pour QR Codes)</span>
              </div>
              <div className="flex-1 w-full flex flex-col sm:flex-row gap-2">
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
              <CardContent className="space-y-4 p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emp-name">Nom complet <span className="text-red-600">*</span></Label>
                    <Input
                      ref={nameInputRef}
                      id="emp-name"
                      value={newEmployee.name}
                      onChange={(e) => {
                        setNewEmployee({ ...newEmployee, name: e.target.value })
                        if (validationErrors.name) {
                          setValidationErrors({ ...validationErrors, name: false })
                        }
                      }}
                      placeholder="Nom de l'employé"
                      className={`border ${validationErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emp-email">Email <span className="text-red-600">*</span></Label>
                    <Input
                      ref={emailInputRef}
                      id="emp-email"
                      type="email"
                      value={newEmployee.email}
                      onChange={(e) => {
                        setNewEmployee({ ...newEmployee, email: e.target.value })
                        if (validationErrors.email) {
                          setValidationErrors({ ...validationErrors, email: false })
                        }
                      }}
                      placeholder="email@salle.com"
                      className={`border ${validationErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
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

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emp-role">Rôle <span className="text-red-600">*</span></Label>
                    <Select
                      value={newEmployee.roleId}
                      onValueChange={(value) => {
                        setNewEmployee({ ...newEmployee, roleId: value })
                        if (validationErrors.roleId) {
                          setValidationErrors({ ...validationErrors, roleId: false })
                        }
                      }}
                    >
                      <SelectTrigger 
                        ref={roleSelectRef}
                        id="emp-role" 
                        className={`border ${validationErrors.roleId ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                      >
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: role.color }}
                              />
                              {role.name}
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value="new">+ Nouveau rôle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newEmployee.roleId === "new" && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="space-y-2">
                        <Label htmlFor="new-role-name">Nom du nouveau rôle</Label>
                        <Input
                          id="new-role-name"
                          value={newEmployee.newRoleName}
                          onChange={(e) => setNewEmployee({ ...newEmployee, newRoleName: e.target.value })}
                          placeholder="Ex: Coach, Formateur..."
                          className="border border-gray-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Couleur du rôle</Label>
                        <div className="flex flex-wrap gap-2">
                          {ROLE_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => setNewEmployee({ ...newEmployee, newRoleColor: color.value })}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                newEmployee.newRoleColor === color.value 
                                  ? 'border-gray-900 scale-110' 
                                  : 'border-gray-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: color.hex }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-3 border border-gray-200 rounded">
                  <Label className="text-sm font-semibold">Permissions d'accès</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="perm-calendar"
                        checked={newEmployee.hasCalendarAccess}
                        onCheckedChange={(checked) => setNewEmployee({ ...newEmployee, hasCalendarAccess: checked as boolean })}
                      />
                      <Label htmlFor="perm-calendar" className="text-sm text-gray-700">
                        Accès au calendrier d'événements
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="perm-schedule"
                        checked={newEmployee.hasWorkScheduleAccess}
                        onCheckedChange={(checked) => setNewEmployee({ ...newEmployee, hasWorkScheduleAccess: checked as boolean })}
                      />
                      <Label htmlFor="perm-schedule" className="text-sm text-gray-700">
                        Accès au planning de travail
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="perm-period"
                        checked={newEmployee.hasWorkPeriodAccess}
                        onCheckedChange={(checked) => setNewEmployee({ ...newEmployee, hasWorkPeriodAccess: checked as boolean })}
                      />
                      <Label htmlFor="perm-period" className="text-sm text-gray-700">
                        Accès aux périodes de travail
                      </Label>
                    </div>
                    <div className="ml-6 text-xs text-gray-500">
                      {newEmployee.hasWorkPeriodAccess 
                        ? "L'employé pourra démarrer des périodes de travail (matin, après-midi, journée)" 
                        : "L'employé n'aura pas accès aux périodes de travail"}
                    </div>
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

          {/* Formulaire d'édition d'employé */}
          {isEditingEmployee && editEmployee && (
            <Card className="border border-blue-200 bg-white">
              <CardHeader className="border-b border-blue-200 bg-blue-50">
                <CardTitle className="text-xl flex items-center space-x-2">
                  <Pencil className="h-6 w-6 text-blue-600" />
                  <span>Modifier l'employé</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Nom complet <span className="text-red-600">*</span></Label>
                    <Input
                      ref={editNameInputRef}
                      id="edit-name"
                      value={editEmployee.name}
                      onChange={(e) => {
                        setEditEmployee({ ...editEmployee, name: e.target.value })
                        if (editValidationErrors.name) {
                          setEditValidationErrors({ ...editValidationErrors, name: false })
                        }
                      }}
                      placeholder="Prénom Nom"
                      className={`border ${editValidationErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editEmployee.email}
                      readOnly
                      className="border border-gray-300 bg-gray-50 cursor-not-allowed"
                      title="L'email ne peut pas être modifié"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Salles assignées</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {gyms.map((gym) => (
                      <div key={gym.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-gym-${gym.id}`}
                          checked={editEmployee.gymIds.includes(gym.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditEmployee({
                                ...editEmployee,
                                gymIds: [...editEmployee.gymIds, gym.id],
                              })
                            } else {
                              setEditEmployee({
                                ...editEmployee,
                                gymIds: editEmployee.gymIds.filter((id) => id !== gym.id),
                              })
                            }
                          }}
                        />
                        <Label htmlFor={`edit-gym-${gym.id}`} className="text-sm text-gray-700">
                          {gym.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-role">Rôle <span className="text-red-600">*</span></Label>
                    <Select
                      value={editEmployee.roleId}
                      onValueChange={(value) => {
                        setEditEmployee({ ...editEmployee, roleId: value })
                        if (editValidationErrors.roleId) {
                          setEditValidationErrors({ ...editValidationErrors, roleId: false })
                        }
                      }}
                    >
                      <SelectTrigger 
                        ref={editRoleSelectRef}
                        id="edit-role" 
                        className={`border ${editValidationErrors.roleId ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                      >
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: role.color }}
                              />
                              {role.name}
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value="new">+ Nouveau rôle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editEmployee.roleId === "new" && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="space-y-2">
                        <Label htmlFor="edit-new-role-name">Nom du nouveau rôle</Label>
                        <Input
                          id="edit-new-role-name"
                          value={editEmployee.newRoleName}
                          onChange={(e) => setEditEmployee({ ...editEmployee, newRoleName: e.target.value })}
                          placeholder="Ex: Coach, Formateur..."
                          className="border border-gray-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Couleur du rôle</Label>
                        <div className="flex flex-wrap gap-2">
                          {ROLE_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => setEditEmployee({ ...editEmployee, newRoleColor: color.value })}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                editEmployee.newRoleColor === color.value 
                                  ? 'border-gray-900 scale-110' 
                                  : 'border-gray-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: color.hex }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-3 border border-gray-200 rounded">
                  <Label className="text-sm font-semibold">Permissions d'accès</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-perm-calendar"
                        checked={editEmployee.hasCalendarAccess}
                        onCheckedChange={(checked) => setEditEmployee({ ...editEmployee, hasCalendarAccess: checked as boolean })}
                      />
                      <Label htmlFor="edit-perm-calendar" className="text-sm text-gray-700">
                        Accès au calendrier d'événements
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-perm-schedule"
                        checked={editEmployee.hasWorkScheduleAccess}
                        onCheckedChange={(checked) => setEditEmployee({ ...editEmployee, hasWorkScheduleAccess: checked as boolean })}
                      />
                      <Label htmlFor="edit-perm-schedule" className="text-sm text-gray-700">
                        Accès au planning de travail
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-perm-period"
                        checked={editEmployee.hasWorkPeriodAccess}
                        onCheckedChange={(checked) => setEditEmployee({ ...editEmployee, hasWorkPeriodAccess: checked as boolean })}
                      />
                      <Label htmlFor="edit-perm-period" className="text-sm text-gray-700">
                        Accès aux périodes de travail
                      </Label>
                    </div>
                    <div className="ml-6 text-xs text-gray-500">
                      {editEmployee.hasWorkPeriodAccess 
                        ? "L'employé pourra démarrer des périodes de travail (matin, après-midi, journée)" 
                        : "L'employé n'aura pas accès aux périodes de travail"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded">
                  <Checkbox
                    id="edit-remote-work"
                    checked={editEmployee.remoteWork}
                    onCheckedChange={(checked) => setEditEmployee({ ...editEmployee, remoteWork: checked as boolean })}
                  />
                  <Label htmlFor="edit-remote-work" className="text-sm text-gray-700">
                    Télétravail autorisé (pas de restriction réseau)
                  </Label>
                </div>

                <div className="flex space-x-2">
                  <Button onClick={saveEditEmployee} className="bg-blue-600 hover:bg-blue-700">
                    <Check className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingEmployee(false)
                      setEditEmployee(null)
                    }}
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
                            {employee.employee_role && (
                              <Badge 
                                className="text-xs px-2 py-0" 
                                style={{ 
                                  backgroundColor: employee.employee_role.color, 
                                  color: '#fff'
                                }}
                              >
                                {employee.employee_role.name}
                              </Badge>
                            )}
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
                          onClick={() => openEditEmployee(employee)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
