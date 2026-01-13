"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, MapPin, Building, Trash2 } from "lucide-react"
import { supabase, type Gym } from "@/lib/api-client"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
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
  const [newGym, setNewGym] = useState({ 
    name: "", 
    location: "", 
    description: "",
    wifi_restricted: false,
    wifi_ssid: "",
    ip_address: ""
  })
  const [isAddingGym, setIsAddingGym] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedGym, setSelectedGym] = useState<{ id: string; name: string } | null>(null)

  const loadGyms = async () => {
    try {
      const { data, error } = await supabase.from("gyms").select("*").order("name")

      if (error) throw error
      setGyms(data || [])
    } catch (error) {
      console.error("Erreur lors du chargement des salles:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGyms()
  }, [])

  // Rafraîchissement automatique toutes les 5 secondes
  useAutoRefresh(loadGyms, 5000)

  const addGym = async () => {
    if (!newGym.name || !newGym.location) return

    try {
      const { data, error } = await supabase
        .from("gyms")
        .insert([
          {
            name: newGym.name,
            location: newGym.location,
            description: newGym.description,
            wifi_restricted: newGym.wifi_restricted,
            wifi_ssid: newGym.wifi_ssid,
            ip_address: newGym.ip_address,
          },
        ])
        .select()

      if (error) throw error

      if (data) {
        setGyms([...gyms, ...data])
      }

      setNewGym({ 
        name: "", 
        location: "", 
        description: "",
        wifi_restricted: false,
        wifi_ssid: "",
        ip_address: ""
      })
      setIsAddingGym(false)
      alert("✅ Salle ajoutée avec succès !")
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error)
      alert("Erreur lors de l'ajout de la salle")
    }
  }

  const confirmDelete = (id: string, name: string) => {
    setSelectedGym({ id, name })
    setShowDeleteDialog(true)
  }

  const executeDelete = async () => {
    if (!selectedGym) return

    try {
      const { error } = await supabase.from("gyms").delete().eq("id", selectedGym.id)
      if (error) throw error

      setGyms(gyms.filter((gym) => gym.id !== selectedGym.id))
      setShowDeleteDialog(false)
      setSelectedGym(null)
      alert("✅ Salle supprimée avec succès")
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
      alert("Erreur lors de la suppression")
    }
  }

  const toggleGymStatus = async (id: string) => {
    const gym = gyms.find((g) => g.id === id)
    if (!gym) return

    try {
      const { error } = await supabase.from("gyms").update({ is_active: !gym.is_active }, { id })

      if (error) throw error

      setGyms(gyms.map((g) => (g.id === id ? { ...g, is_active: !g.is_active } : g)))
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-lg text-gray-900">Chargement des salles...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">
          🏢 Gestion des Salles
        </h2>
        <Button
          onClick={() => setIsAddingGym(!isAddingGym)}
          className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Salle
        </Button>
      </div>

      {/* Formulaire d'ajout */}
      {isAddingGym && (
        <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
          <CardHeader className="bg-gradient-to-r from-red-600 to-black text-white rounded-t-xl">
            <CardTitle>Ajouter une nouvelle salle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
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
            <div className="mt-4 pt-4 border-t-2 border-gray-200">
              <div className="flex items-center space-x-3 mb-4">
                <input
                  type="checkbox"
                  id="gym-wifi-restricted"
                  checked={newGym.wifi_restricted}
                  onChange={(e) => setNewGym({ ...newGym, wifi_restricted: e.target.checked })}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <Label htmlFor="gym-wifi-restricted" className="text-lg font-semibold text-gray-900 cursor-pointer">
                  📶 Restreindre l'accès à cette salle via WiFi
                </Label>
              </div>
              
              {newGym.wifi_restricted && (
                <div className="grid grid-cols-2 gap-4 ml-7">
                  <div className="space-y-2">
                    <Label htmlFor="gym-wifi-ssid">Nom du réseau (SSID)</Label>
                    <Input
                      id="gym-wifi-ssid"
                      value={newGym.wifi_ssid}
                      onChange={(e) => setNewGym({ ...newGym, wifi_ssid: e.target.value })}
                      placeholder="FitEvo_WiFi"
                      className="border-2 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gym-ip">Adresse IP</Label>
                    <Input
                      id="gym-ip"
                      value={newGym.ip_address}
                      onChange={(e) => setNewGym({ ...newGym, ip_address: e.target.value })}
                      placeholder="192.168.1.1"
                      className="border-2 rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gym-description">Description (optionnelle)</Label>
              <Textarea
                id="gym-description"
                value={newGym.description}
                onChange={(e) => setNewGym({ ...newGym, description: e.target.value })}
                placeholder="Description de la salle, équipements, spécialités..."
                className="border-2 rounded-xl"
                rows={3}
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={addGym} className="bg-red-600 hover:bg-red-700 rounded-xl">
                Ajouter
              </Button>
              <Button variant="outline" onClick={() => setIsAddingGym(false)} className="border-2 rounded-xl">
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des salles */}
      <div className="grid gap-6">
        {gyms.map((gym) => (
          <Card key={gym.id} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                    <Building className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-bold text-2xl">{gym.name}</h3>
                      <Badge variant={gym.is_active ? "default" : "secondary"} className={`rounded-full ${gym.is_active ? 'bg-red-600' : 'bg-gray-400'}`}>
                        {gym.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-700 mb-2">
                      <MapPin className="h-4 w-4" />
                      <span>{gym.location}</span>
                    </div>
                    {gym.description && <p className="text-gray-600 text-sm mb-2">{gym.description}</p>}
                    
                    {/* Informations WiFi */}
                    {gym.wifi_restricted && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm font-semibold text-gray-700 mb-2">📶 Accès restreint au WiFi</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {gym.wifi_ssid && (
                            <div>
                              <span className="text-gray-500">SSID: </span>
                              <span className="font-medium text-gray-900">{gym.wifi_ssid}</span>
                            </div>
                          )}
                          {gym.ip_address && (
                            <div>
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
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleGymStatus(gym.id)}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-900"
                  >
                    {gym.is_active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmDelete(gym.id, gym.name)}
                    className="border-2 border-red-600 rounded-xl text-red-600 hover:bg-red-50 bg-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
              className="text-lg px-6 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-900"
            >
              ❌ Annuler
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
