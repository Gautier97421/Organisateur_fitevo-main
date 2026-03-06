"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Coffee, Loader2, MapPin, Sunrise, Sunset, Sun } from "lucide-react"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"

interface EmployeeStatus {
  id: string
  name: string
  email: string
  currentPeriod: "matin" | "aprem" | "journee" | null
  startTime: string
  workDuration: string // Durée en texte (ex: "2h 30min")
  gymName: string | null
  isOnBreak: boolean
  breakStartTime?: string
  lastUpdate: string
}

export function RealTimeMonitor() {
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadEmployeeData = async () => {
    try {
      console.log('🔄 Chargement des données employés pour le suivi temps réel...')
      
      // Charger tous les utilisateurs avec rôle employee
      const responseEmployees = await fetch('/api/db/users')
      if (!responseEmployees.ok) {
        console.error('❌ Erreur chargement employés:', responseEmployees.status)
        setEmployeeStatuses([])
        setIsLoading(false)
        return
      }
      
      const employeesData = await responseEmployees.json()
      const allUsers = employeesData.data || []
      
      console.log(`📊 Total utilisateurs: ${allUsers.length}`)
      console.log('🔎 Recherche employés actifs...')
      
      // Filtrer pour garder uniquement les employés actifs
      // Note: l'API retourne is_active au lieu de active
      const employees = allUsers.filter((u: any) => {
        const isEmployee = u.role === 'employee'
        const isActive = u.is_active === true || u.active === true
        console.log(`  - ${u.name}: role=${u.role}, is_active=${u.is_active}, active=${u.active} → ${isEmployee && isActive ? '✅' : '❌'}`)
        return isEmployee && isActive
      })
      console.log(`👥 ${employees.length} employés actifs trouvés`)

      if (employees.length === 0) {
        console.log('⚠️ Aucun employé actif')
        setEmployeeStatuses([])
        setIsLoading(false)
        return
      }

      // Charger les données de chaque employé
      const today = new Date().toISOString().split('T')[0]
      console.log(`📅 Date du jour: ${today}`)
      
      const statusPromises = employees.map(async (emp: any) => {
        console.log(`\n🔍 Vérification employé: ${emp.name} (${emp.email})`)
        
        // Charger le planning du jour
        const scheduleUrl = `/api/db/work_schedules?user_id=${emp.id}&work_date=${today}`
        console.log(`  📡 Requête: ${scheduleUrl}`)
        
        const responseSchedule = await fetch(scheduleUrl)
        let currentPeriod: "matin" | "aprem" | "journee" | null = null
        let startTime = ""
        let workDuration = ""
        let gymName: string | null = null
        let isOnBreak = false
        let breakStartTime: string | undefined = undefined
        
        if (responseSchedule.ok) {
          const scheduleData = await responseSchedule.json()
          const schedules = Array.isArray(scheduleData.data) ? scheduleData.data : []
          console.log(`  📋 ${schedules.length} période(s) trouvée(s)`)
          
          // Debug: afficher toutes les périodes
          schedules.forEach((s: any, idx: number) => {
            console.log(`    ${idx + 1}. type="${s.type}", end_time="${s.end_time}", is_temporary=${s.is_temporary}`)
            console.log(`       notes: "${s.notes?.substring(0, 80)}"`)
          })
          
          // Chercher une session de travail active (type=work sans end_time ou end_time vide)
          const activeWork = schedules.find((s: any) => s.type === 'work' && (!s.end_time || s.end_time === ''))
          
          if (activeWork) {
            console.log(`  ✅ Période active trouvée!`)
            console.log(`    - start_time: ${activeWork.start_time}`)
            console.log(`    - end_time: "${activeWork.end_time}"`)
            console.log(`    - notes: ${activeWork.notes}`)
            
            if (activeWork.notes) {
              // Extraire la période depuis les notes
              const periodMatch = activeWork.notes.match(/Période:\s*(matin|aprem|journee)/)
              if (periodMatch) {
                currentPeriod = periodMatch[1] as "matin" | "aprem" | "journee"
                startTime = activeWork.start_time || ""
                console.log(`    ✨ Période détectée: ${currentPeriod} à ${startTime}`)
                
                // Calculer la durée de travail
                const now = new Date()
                const [hours, minutes] = startTime.split(':').map(Number)
                const startDate = new Date()
                startDate.setHours(hours, minutes, 0, 0)
                
                const diffMs = now.getTime() - startDate.getTime()
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                
                if (diffHours > 0) {
                  workDuration = `${diffHours}h ${diffMinutes}min`
                } else {
                  workDuration = `${diffMinutes}min`
                }
                console.log(`    ⏱️ Durée: ${workDuration}`)
                
                // Extraire le nom de la salle depuis GymId dans les notes
                const gymIdMatch = activeWork.notes.match(/GymId:\s*([a-zA-Z0-9-]+)/)
                if (gymIdMatch && gymIdMatch[1]) {
                  // Charger le nom de la salle
                  try {
                    const gymResponse = await fetch(`/api/db/gyms/${gymIdMatch[1]}`)
                    if (gymResponse.ok) {
                      const gymData = await gymResponse.json()
                      gymName = gymData.data?.name || null
                      console.log(`    📍 Salle: ${gymName}`)
                    }
                  } catch (e) {
                    console.log(`    ⚠️ Impossible de charger la salle`)
                  }
                }
              } else {
                console.log(`    ⚠️ Pas de période trouvée dans les notes`)
              }
            } else {
              console.log(`    ⚠️ Pas de notes sur cette période`)
            }
          } else {
            console.log(`  ❌ Aucune période active (toutes ont un end_time ou ne sont pas type=work)`)
          }
          
          // Chercher une pause active
          const activeBreak = schedules.find((s: any) => s.type === 'break' && (!s.end_time || s.end_time === ''))
          if (activeBreak) {
            isOnBreak = true
            breakStartTime = activeBreak.start_time
            console.log(`  ☕ En pause depuis ${breakStartTime}`)
          }
        } else {
          console.log(`  ❌ Erreur requête planning: ${responseSchedule.status}`)
        }

        return {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          currentPeriod: currentPeriod,
          startTime: startTime,
          workDuration: workDuration,
          gymName: gymName,
          isOnBreak: isOnBreak,
          breakStartTime: breakStartTime,
          lastUpdate: new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }
      })

      const statuses = await Promise.all(statusPromises)
      
      // Ne garder que les employés qui ont une période active
      const activeStatuses = statuses.filter(s => s.currentPeriod !== null)
      console.log(`\n📊 Résultat final: ${activeStatuses.length} employé(s) en activité`)
      activeStatuses.forEach(s => {
        console.log(`  ✓ ${s.name}: ${s.currentPeriod} depuis ${s.workDuration}`)
      })
      
      setEmployeeStatuses(activeStatuses)
    } catch (error) {
      console.error("❌ Erreur lors du chargement des données:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEmployeeData()
  }, [])

  // Rafraîchissement automatique toutes les 10 secondes
  useAutoRefresh(loadEmployeeData, 10000)

  const getPeriodLabel = (period: string | null) => {
    if (!period) return "Non démarré"
    switch (period) {
      case "matin":
        return "Matin"
      case "aprem":
        return "Après-midi"
      case "journee":
        return "Journée entière"
      default:
        return period
    }
  }

  const getPeriodIcon = (period: "matin" | "aprem" | "journee" | null) => {
    switch (period) {
      case "matin":
        return <Sunrise className="h-5 w-5 text-orange-500" />
      case "aprem":
        return <Sunset className="h-5 w-5 text-orange-600" />
      case "journee":
        return <Sun className="h-5 w-5 text-yellow-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Suivi Temps Réel</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
          <Clock className="h-4 w-4" />
          <span>Mise à jour : {new Date().toLocaleTimeString("fr-FR")}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-300" />
          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Chargement...</span>
        </div>
      ) : employeeStatuses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-lg text-gray-500 dark:text-gray-400">Aucun employé en activité</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Les employés actifs apparaîtront ici dès qu'ils commenceront leur période de travail
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {employeeStatuses.map((employee) => (
            <Card key={employee.id} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg">
                      {getPeriodIcon(employee.currentPeriod)}
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-white">
                        {employee.name}
                      </CardTitle>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{employee.email}</p>
                    </div>
                  </div>
                  {employee.isOnBreak && (
                    <Badge variant="secondary" className="flex items-center space-x-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                      <Coffee className="h-3 w-3" />
                      <span>En pause</span>
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  {/* Période */}
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Période</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {getPeriodLabel(employee.currentPeriod)}
                    </p>
                  </div>
                  
                  {/* Heure de début */}
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Démarré à</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {employee.startTime || "-"}
                    </p>
                  </div>
                  
                  {/* Durée de travail */}
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Depuis</p>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {employee.workDuration || "-"}
                    </p>
                  </div>
                  
                  {/* Salle */}
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Salle</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span>{employee.gymName || "Non définie"}</span>
                    </p>
                  </div>
                </div>

                {employee.isOnBreak && (
                  <div className="flex items-center space-x-2 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-200 dark:border-orange-800">
                    <Coffee className="h-4 w-4" />
                    <span className="text-sm">Pause en cours depuis {employee.breakStartTime}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && employeeStatuses.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Résumé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {employeeStatuses.filter(emp => !emp.isOnBreak).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Employés en activité</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {employeeStatuses.filter(emp => emp.isOnBreak).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">En pause</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
