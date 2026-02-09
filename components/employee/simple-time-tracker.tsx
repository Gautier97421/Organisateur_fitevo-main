"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, CheckCircle, Loader2 } from "lucide-react"
import { supabase, type Gym } from "@/lib/api-client"

interface TimeEntry {
  id: string
  check_in_time: string
  gym: {
    name: string
  }
}

export function SimpleTimeTracker() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPunching, setIsPunching] = useState(false)
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    const email = localStorage.getItem("userEmail")
    if (email) {
      setUserEmail(email)
      loadData(email)
    }
  }, [])

  const loadData = async (email: string) => {
    try {
      // Charger les salles
      const { data: gymsData } = await supabase.from("gyms").select("*").eq("is_active", true)
      if (gymsData) setGyms(gymsData)

      // Charger les 5 derniers pointages
      const response = await fetch(`/api/time-entries?user_email=${email}`)
      if (response.ok) {
        const result = await response.json()
        if (result.data) {
          setRecentEntries(result.data.slice(0, 5))
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const punchIn = async (gymId: string, gymName: string) => {
    setIsPunching(true)
    try {
      const response = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: userEmail,
          gym_id: gymId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || "Erreur lors du pointage")
      }

      const result = await response.json()
      
      // Ajouter le nouveau pointage en haut de la liste
      if (result.data) {
        setRecentEntries([result.data, ...recentEntries.slice(0, 4)])
      }

      alert(`✓ Pointage enregistré à ${gymName}`)
    } catch (error: any) {
      console.error("Erreur pointage:", error)
      alert(error.message || "Erreur lors du pointage")
    } finally {
      setIsPunching(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl bg-white">
        <CardHeader className="border-b border-gray-200 bg-gray-50">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-red-600" />
            Pointage Simple
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-gray-600">
            Sélectionnez la salle où vous vous trouvez pour enregistrer votre pointage :
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gyms.map((gym) => (
              <Button
                key={gym.id}
                onClick={() => punchIn(gym.id, gym.name)}
                disabled={isPunching}
                className="h-auto py-4 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5" />
                  <span className="text-lg font-medium">{gym.name}</span>
                </div>
                {isPunching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {recentEntries.length > 0 && (
        <Card className="border-0 shadow-xl bg-white">
          <CardHeader className="border-b border-gray-200 bg-gray-50">
            <CardTitle className="text-lg font-bold text-gray-900">
              Derniers pointages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-900">{entry.gym.name}</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    {formatDateTime(entry.check_in_time)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
