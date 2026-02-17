"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, MapPin, Building, Trash2, Pencil, QrCode, ExternalLink, Download, XCircle, Wifi, Loader2 } from "lucide-react"
import { supabase, type Gym } from "@/lib/api-client"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { QRCodeDisplay } from "./qr-code-display"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function GymManager() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [siteUrl, setSiteUrl] = useState("")
  const [newGym, setNewGym] = useState({ 
    name: "", 
    location: "", 
    description: "",
    wifi_restricted: false,
    wifi_ssid: "",
    ip_address: "",
    qr_code_enabled: false
  })
  const [isAddingGym, setIsAddingGym] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingIp, setIsLoadingIp] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedGym, setSelectedGym] = useState<{ id: string; name: string } | null>(null)
  const [isEditingGym, setIsEditingGym] = useState(false)
  const [editGym, setEditGym] = useState<{
    id: string
    name: string
    location: string
    description?: string
    wifi_restricted: boolean
    wifi_ssid: string
    ip_address: string
    is_active: boolean
    qr_code_enabled: boolean
  } | null>(null)

  // Fonction pour récupérer l'IP actuelle
  const fetchCurrentIp = async (isEdit: boolean = false) => {
    setIsLoadingIp(true)
    try {
      const response = await fetch('/api/get-ip')
      if (response.ok) {
        const result = await response.json()
        if (result.ip && result.ip !== "unknown") {
          if (isEdit && editGym) {
            setEditGym({ ...editGym, ip_address: result.ip })
          } else {
            setNewGym(prev => ({ ...prev, ip_address: result.ip }))
          }
          if (result.isLocal) {
            alert("⚠️ Vous êtes en réseau local. En production, l'IP publique de la salle sera détectée automatiquement.")
          }
        } else {
          alert("Impossible de détecter l'adresse IP. Vérifiez votre connexion.")
        }
      }
    } catch (error) {
      console.error("Error fetching IP:", error)
      alert("Erreur lors de la récupération de l'adresse IP")
    } finally {
      setIsLoadingIp(false)
    }
  }

  const loadGyms = async () => {
    try {
      const response = await fetch('/api/db/gyms?orderBy=name')
      if (!response.ok) {
        throw new Error('Erreur lors du chargement')
      }
      const result = await response.json()
      const gymsData = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])
      setGyms(gymsData)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSiteUrl = async () => {
    try {
      const response = await fetch('/api/db/app_config?key=site_url')
      if (response.ok) {
        const result = await response.json()
        if (result.data && result.data.length > 0) {
          setSiteUrl(result.data[0].value || "")
        }
      }
    } catch (error) {
      // Erreur silencieuse
    }
  }

  useEffect(() => {
    loadGyms()
    loadSiteUrl()
  }, [])

  // Rafraîchissement automatique toutes les 15 secondes
  useAutoRefresh(loadGyms, 15000)

  const addGym = async () => {
    if (!newGym.name || !newGym.location) return
    if (newGym.wifi_restricted && (!newGym.wifi_ssid || !newGym.ip_address)) {
      return
    }

    try {
      const response = await fetch('/api/db/gyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            name: newGym.name,
            address: newGym.location,
            wifi_restricted: newGym.wifi_restricted,
            wifi_ssid: newGym.wifi_ssid || null,
            ip_address: newGym.ip_address || null,
            qr_code_enabled: newGym.qr_code_enabled,
            is_active: true
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(JSON.stringify(errorData, null, 2))
      }

      const result = await response.json()
      if (result.data) {
        setGyms([...gyms, result.data])
      }

      setNewGym({ 
        name: "", 
        location: "", 
        description: "",
        wifi_restricted: false,
        wifi_ssid: "",
        ip_address: "",
        qr_code_enabled: false
      })
      setIsAddingGym(false)
    } catch (error) {
      console.error("Erreur lors de l'ajout de la salle:", error)
    }
  }

  const confirmDelete = (id: string, name: string) => {
    setSelectedGym({ id, name })
    setShowDeleteDialog(true)
  }

  const openEditGym = (gym: Gym) => {
    setEditGym({
      id: gym.id,
      name: gym.name,
      location: gym.location || "",
      description: gym.description || "",
      wifi_restricted: !!gym.wifi_restricted,
      wifi_ssid: gym.wifi_ssid || "",
      ip_address: gym.ip_address || "",
      is_active: !!gym.is_active,
      qr_code_enabled: !!gym.qr_code_enabled,
    })
    setIsEditingGym(true)
  }

  const updateGym = async () => {
    if (!editGym) return
    if (!editGym.name || !editGym.location) return
    if (editGym.wifi_restricted && (!editGym.wifi_ssid || !editGym.ip_address)) {
      return
    }

    try {
      const response = await fetch(`/api/db/gyms/${editGym.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editGym.name,
          location: editGym.location,
          wifi_restricted: editGym.wifi_restricted,
          wifi_ssid: editGym.wifi_ssid || null,
          ip_address: editGym.ip_address || null,
          qr_code_enabled: editGym.qr_code_enabled,
          is_active: editGym.is_active,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Erreur lors de la mise à jour")
      }

      const result = await response.json()
      if (result.data) {
        setGyms(gyms.map((g) => (g.id === editGym.id ? result.data : g)))
      }
      setIsEditingGym(false)
      setEditGym(null)
    } catch (error) {
      console.error("Erreur lors de la modification:", error)
    }
  }

  const executeDelete = async () => {
    if (!selectedGym) return

    try {
      const response = await fetch(`/api/db/gyms/${selectedGym.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la suppression')
      }

      setGyms(gyms.filter((gym) => gym.id !== selectedGym.id))
      setShowDeleteDialog(false)
      setSelectedGym(null)
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
    }
  }

  const toggleGymStatus = async (id: string) => {
    const gym = gyms.find((g) => g.id === id)
    if (!gym) return

    try {
      const response = await fetch(`/api/db/gyms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !gym.is_active })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la mise à jour')
      }

      setGyms(gyms.map((g) => (g.id === id ? { ...g, is_active: !g.is_active } : g)))
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-lg text-gray-900 dark:text-white">Chargement des salles...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 px-2 md:px-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 md:space-x-3">
          <Building className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Gestion des Salles</h2>
        </div>
        <Button
          onClick={() => setIsAddingGym(!isAddingGym)}
          className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg flex items-center gap-2 w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Salle
        </Button>
      </div>

      {/* Formulaire d'ajout */}
      {isAddingGym && (
        <Card className="border-0 shadow-2xl bg-white dark:bg-gray-800">
          <CardHeader className="bg-red-600 dark:bg-red-700 text-white rounded-t-xl p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">Ajouter une nouvelle salle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gym-name">Nom de la salle *</Label>
                <Input
                  id="gym-name"
                  value={newGym.name}
                  onChange={(e) => setNewGym({ ...newGym, name: e.target.value })}
                  placeholder="Salle Principale"
                  className="border-2 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gym-location">Adresse *</Label>
                <Input
                  id="gym-location"
                  value={newGym.location}
                  onChange={(e) => setNewGym({ ...newGym, location: e.target.value })}
                  placeholder="123 Rue du Sport, Ville"
                  className="border-2 rounded-xl"
                />
              </div>
            </div>
            
            {/* Section WiFi */}
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="gym-wifi-restricted"
                  checked={newGym.wifi_restricted}
                  onChange={(e) => setNewGym({ ...newGym, wifi_restricted: e.target.checked })}
                  className="w-5 h-5 rounded border-2"
                />
                <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  📶 Restreindre l'accès à cette salle via WiFi
                </span>
              </label>
              
              {newGym.wifi_restricted && (
                <div className="ml-8 space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Les employés devront se connecter au réseau WiFi spécifié pour accéder à cette salle.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gym-wifi-ssid" className="dark:text-gray-300">Nom du réseau (SSID)</Label>
                      <Input
                        id="gym-wifi-ssid"
                        value={newGym.wifi_ssid}
                        onChange={(e) => setNewGym({ ...newGym, wifi_ssid: e.target.value })}
                        placeholder="FitEvo_WiFi"
                        className="border-2 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gym-ip" className="dark:text-gray-300">
                        Adresse IP de la salle
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="gym-ip"
                          value={newGym.ip_address}
                          onChange={(e) => setNewGym({ ...newGym, ip_address: e.target.value })}
                          placeholder="Ex: 90.123.45.67"
                          className="border-2 rounded-xl flex-1"
                        />
                        <Button
                          type="button"
                          onClick={() => fetchCurrentIp(false)}
                          disabled={isLoadingIp}
                          className="bg-green-600 hover:bg-green-700 text-white rounded-xl whitespace-nowrap"
                          title="Utiliser l'adresse IP de votre connexion actuelle"
                        >
                          {isLoadingIp ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Wifi className="h-4 w-4 mr-1" />
                              Mon IP
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Cliquez sur "Mon IP" depuis le réseau de la salle pour enregistrer automatiquement son adresse IP.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newGym.qr_code_enabled}
                  onChange={(e) => setNewGym({ ...newGym, qr_code_enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-2"
                />
                <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Générer un QR Code pour cette salle
                </span>
              </label>
              {newGym.qr_code_enabled && (
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                  Le QR Code sera généré automatiquement après la création de la salle.
                  Le super admin configure l'URL globale du site.
                </p>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={addGym}
                className="bg-red-600 hover:bg-red-700 rounded-xl"
                disabled={
                  !newGym.name ||
                  !newGym.location ||
                  (newGym.wifi_restricted && (!newGym.wifi_ssid || !newGym.ip_address))
                }
              >
                Ajouter
              </Button>
              <Button variant="outline" onClick={() => setIsAddingGym(false)} className="border-2 rounded-xl">
                Annuler
              </Button>
            </div>
            {newGym.wifi_restricted && (!newGym.wifi_ssid || !newGym.ip_address) && (
              <p className="text-sm text-red-600">
                Le SSID et l'adresse IP sont obligatoires si le réseau est restreint.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Liste des salles */}
      <div className="grid gap-6">
        {gyms.map((gym) => (
          <Card key={gym.id} className="border-0 shadow-xl bg-white dark:bg-gray-800">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col lg:flex-row items-start gap-4">
                <div className="flex items-start space-x-3 md:space-x-4 flex-1 w-full">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-red-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
                    <Building className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h3 className="font-bold text-xl md:text-2xl text-gray-900 truncate">{gym.name}</h3>
                      <Badge variant={gym.is_active ? "default" : "secondary"} className={`rounded-full ${gym.is_active ? 'bg-red-600' : 'bg-gray-400'} w-fit`}>
                        {gym.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-700 mb-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm md:text-base break-words">{gym.location}</span>
                    </div>
                    {gym.description && <p className="text-gray-600 text-sm mb-2 break-words">{gym.description}</p>}
                    
                    {/* Informations WiFi */}
                    {gym.wifi_restricted && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm font-semibold text-gray-700 mb-2">📶 Accès restreint au WiFi</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 text-sm">
                          {gym.wifi_ssid && (
                            <div key="ssid">
                              <span className="text-gray-500">SSID: </span>
                              <span className="font-medium text-gray-900">{gym.wifi_ssid}</span>
                            </div>
                          )}
                          {gym.ip_address && (
                            <div key="ip">
                              <span className="text-gray-500">IP: </span>
                              <span className="font-medium text-gray-900">{gym.ip_address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 text-xs text-gray-500">
                      Crée le {new Date(gym.created_at || "").toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                </div>
                
                {/* Affichage du QR Code si activé */}
                {gym.qr_code_enabled && (
                  <div className="mt-4">
                    <QRCodeDisplay gymId={gym.id} gymName={gym.name} siteUrl={siteUrl} />
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleGymStatus(gym.id)}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-900 text-xs md:text-sm w-full sm:w-auto"
                  >
                    {gym.is_active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditGym(gym)}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-900 text-xs md:text-sm w-full sm:w-auto"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmDelete(gym.id, gym.name)}
                    className="border-2 border-red-600 rounded-xl text-red-600 hover:bg-red-50 bg-white text-xs md:text-sm w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de modification */}
      <Dialog open={isEditingGym} onOpenChange={setIsEditingGym}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Modifier la salle</DialogTitle>
            <DialogDescription className="text-sm">Mettre à jour les informations de la salle.</DialogDescription>
          </DialogHeader>
          {editGym && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de la salle *</Label>
                  <Input
                    value={editGym.name}
                    onChange={(e) => setEditGym({ ...editGym, name: e.target.value })}
                    className="border-2 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse *</Label>
                  <Input
                    value={editGym.location}
                    onChange={(e) => setEditGym({ ...editGym, location: e.target.value })}
                    className="border-2 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editGym.wifi_restricted}
                    onChange={(e) => setEditGym({ ...editGym, wifi_restricted: e.target.checked })}
                    className="w-5 h-5 rounded border-2"
                  />
                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    📶 Restreindre l'accès à cette salle via WiFi
                  </span>
                </label>

                {editGym.wifi_restricted && (
                  <div className="ml-8 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Les employés devront se connecter au réseau WiFi spécifié pour accéder à cette salle.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="dark:text-gray-300">Nom du réseau (SSID)</Label>
                        <Input
                          value={editGym.wifi_ssid}
                          onChange={(e) => setEditGym({ ...editGym, wifi_ssid: e.target.value })}
                          className="border-2 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="dark:text-gray-300">
                          Adresse IP de la salle
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={editGym.ip_address}
                            onChange={(e) => setEditGym({ ...editGym, ip_address: e.target.value })}
                            placeholder="Ex: 90.123.45.67"
                            className="border-2 rounded-xl flex-1"
                          />
                          <Button
                            type="button"
                            onClick={() => fetchCurrentIp(true)}
                            disabled={isLoadingIp}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-xl whitespace-nowrap"
                            title="Utiliser l'adresse IP de votre connexion actuelle"
                          >
                            {isLoadingIp ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Wifi className="h-4 w-4 mr-1" />
                                Mon IP
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Cliquez sur "Mon IP" depuis le réseau de la salle pour enregistrer automatiquement son adresse IP.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {editGym.wifi_restricted && (!editGym.wifi_ssid || !editGym.ip_address) && (
                <p className="text-sm text-red-600">
                  Le SSID et l'adresse IP sont obligatoires si le réseau est restreint.
                </p>
              )}

              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editGym.qr_code_enabled}
                    onChange={(e) => setEditGym({ ...editGym, qr_code_enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-2"
                  />
                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Générer un QR Code pour cette salle
                  </span>
                </label>
                {editGym.qr_code_enabled && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                    Le QR Code est généré automatiquement avec l'URL configurée par le super admin.
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingGym(false)} className="border-2 rounded-xl">
              Annuler
            </Button>
            <Button
              onClick={updateGym}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
              disabled={
                !editGym ||
                !editGym.name ||
                !editGym.location ||
                (editGym.wifi_restricted && (!editGym.wifi_ssid || !editGym.ip_address))
              }
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2">
              <Trash2 className="h-6 w-6 text-red-600" />
              <span>Confirmer la suppression</span>
            </DialogTitle>
            <DialogDescription className="text-lg">
              Êtes-vous sûr de vouloir supprimer la salle <strong>{selectedGym?.name}</strong> ?
              <br />
              <span className="text-red-600 font-medium">
                Toutes les données associées (tâches, employés, événements) seront également supprimées.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="text-lg px-6 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-900 flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Annuler
            </Button>
            <Button onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white text-lg px-6">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
