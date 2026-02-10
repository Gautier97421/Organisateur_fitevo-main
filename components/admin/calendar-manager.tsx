"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, Check, X, ChevronLeft, ChevronRight, Plus, ArrowLeft, Bell, CheckCircle, XCircle } from "lucide-react"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/api-client"

interface CalendarEvent {
  id: string
  title: string
  description?: string
  event_date: string
  event_time?: string
  duration_minutes: number
  created_by_email: string
  created_by_name: string
  status: "pending" | "approved" | "rejected"
  rejection_reason?: string
  created_at: string
}

export function CalendarManager() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeView, setActiveView] = useState<"calendar" | "list" | "pending">("calendar")
  const [calendarView, setCalendarView] = useState<"year" | "month">("year")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [showAddEventDialog, setShowAddEventDialog] = useState(false)
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    event_time: "",
    duration_minutes: 60,
  })
  const [reminderSettings, setReminderSettings] = useState({
    days_before: 1,
    recipient_type: "all" as "all" | "admins" | "employees",
    custom_message: "",
  })

  const loadEvents = async () => {
    try {
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1)
      const endOfYear = new Date(currentDate.getFullYear(), 11, 31)

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", startOfYear.toISOString().split("T")[0])
        .lte("event_date", endOfYear.toISOString().split("T")[0])
        .order("event_date", { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      // Erreur silencieuse
    } finally {
      setIsLoading(false)
    }
  }

  const loadMonthEvents = async () => {
    if (!selectedMonth) return

    try {
      const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
      const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", startOfMonth.toISOString().split("T")[0])
        .lte("event_date", endOfMonth.toISOString().split("T")[0])
        .order("event_date", { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      // Erreur silencieuse
    }
  }

  useEffect(() => {
    if (calendarView === "year") {
      loadEvents()
    } else if (selectedMonth) {
      loadMonthEvents()
    }
  }, [currentDate, calendarView, selectedMonth])

  // Rafraîchissement automatique toutes les 15 secondes
  useAutoRefresh(() => {
    if (calendarView === "year") {
      loadEvents()
    } else if (selectedMonth) {
      loadMonthEvents()
    }
  }, 15000, [calendarView, selectedMonth])

  const addEvent = async () => {
    if (!newEvent.title || !selectedDate) return

    // Valider que selectedDate est une date valide
    if (!(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
      alert("Date invalide. Veuillez sélectionner une date correcte.")
      return
    }

    try {
      const userEmail = localStorage.getItem("userEmail") || ""
      const userName = localStorage.getItem("userName") || ""

      const userId = localStorage.getItem("userId")
      
      const { data, error } = await supabase
        .from("calendar_events")
        .insert([
          {
            title: newEvent.title,
            description: newEvent.description,
            event_date: selectedDate.toISOString(), // DateTime ISO-8601 complet
            event_time: newEvent.event_time || null,
            duration_minutes: newEvent.duration_minutes,
            created_by_email: userEmail,
            created_by_name: userName,
            status: "approved",
            user_id: userId,
          },
        ])

      if (error) throw error

      // Recharger les événements après l'ajout
      if (calendarView === "year") {
        await loadEvents()
      } else if (selectedMonth) {
        await loadMonthEvents()
      }

      setNewEvent({
        title: "",
        description: "",
        event_time: "",
        duration_minutes: 60,
      })
      setShowAddEventDialog(false)
      setSelectedDate(null)

      alert("Événement créé avec succès !")
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error)
      alert("Erreur lors de l'ajout de l'événement")
    }
  }

  const approveEvent = async (eventId: string) => {
    try {
      const adminEmail = localStorage.getItem("userEmail")
      const { data: admin } = await supabase.from("admins").select("id").eq("email", adminEmail).single()

      const { error } = await supabase
        .from("calendar_events")
        .update({
          status: "approved",
          approved_by: admin?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", eventId)

      if (error) throw error

      setEvents(events.map((event) => (event.id === eventId ? { ...event, status: "approved" as const } : event)))

      alert("Événement approuvé avec succès !")
    } catch (error) {
      console.error("Erreur lors de l'approbation:", error)
      alert("Erreur lors de l'approbation")
    }
  }

  const rejectEvent = async (eventId: string, reason: string) => {
    try {
      const adminEmail = localStorage.getItem("userEmail")
      const { data: admin } = await supabase.from("admins").select("id").eq("email", adminEmail).single()

      const { error } = await supabase
        .from("calendar_events")
        .update({
          status: "rejected",
          approved_by: admin?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", eventId)

      if (error) throw error

      setEvents(
        events.map((event) =>
          event.id === eventId ? { ...event, status: "rejected" as const, rejection_reason: reason } : event,
        ),
      )

      setRejectionReason("")
      setSelectedEventId(null)
      setShowRejectionDialog(false)
      alert("Événement refusé")
    } catch (error) {
      console.error("Erreur lors du refus:", error)
      alert("Erreur lors du refus")
    }
  }

  const addReminder = async (eventId: string) => {
    try {
      const event = events.find((e) => e.id === eventId)
      if (!event) return

      const reminderDate = new Date(event.event_date)
      reminderDate.setDate(reminderDate.getDate() - reminderSettings.days_before)

      const { error } = await supabase.from("event_reminders").insert([
        {
          event_id: eventId,
          reminder_date: reminderDate.toISOString().split("T")[0],
          recipient_type: reminderSettings.recipient_type,
          custom_message: reminderSettings.custom_message,
          created_by: localStorage.getItem("userEmail"),
        },
      ])

      if (error) throw error

      setShowReminderDialog(false)
      setReminderSettings({
        days_before: 1,
        recipient_type: "all",
        custom_message: "",
      })
      alert("Rappel programmé avec succès !")
    } catch (error) {
      console.error("Erreur lors de l'ajout du rappel:", error)
      alert("Erreur lors de l'ajout du rappel")
    }
  }

  const getMonthsInYear = () => {
    const months = []
    for (let month = 0; month < 12; month++) {
      const date = new Date(currentDate.getFullYear(), month, 1)
      months.push(date)
    }
    return months
  }

  const getEventsForMonth = (month: Date) => {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)

    return events.filter((event) => {
      const eventDate = new Date(event.event_date)
      return eventDate >= startOfMonth && eventDate <= endOfMonth
    })
  }

  const getEventsForDate = (date: Date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return []
    
    const dateString = date.toISOString().split("T")[0]
    return events.filter((event) => {
      try {
        const eventDate = new Date(event.event_date)
        if (isNaN(eventDate.getTime())) return false
        return eventDate.toISOString().split("T")[0] === dateString
      } catch {
        return false
      }
    })
  }

  const getDaysInMonth = () => {
    if (!selectedMonth) return []

    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    
    // Ajuster pour commencer le lundi (0 = dimanche, 1 = lundi, etc.)
    // Si dimanche (0), on le transforme en 6 (dernier jour de la semaine)
    let startingDayOfWeek = firstDay.getDay() - 1
    if (startingDayOfWeek === -1) startingDayOfWeek = 6

    const days = []

    // Jours du mois précédent (seulement si nécessaire)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      days.push({ date: prevDate, isCurrentMonth: false })
    }

    // Jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push({ date, isCurrentMonth: true })
    }

    // Jours du mois suivant (seulement pour compléter la dernière semaine)
    const currentLength = days.length
    const remainingDays = currentLength % 7 === 0 ? 0 : 7 - (currentLength % 7)
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day)
      days.push({ date: nextDate, isCurrentMonth: false })
    }

    return days
  }

  const navigateYear = (direction: "prev" | "next") => {
    setCurrentDate(new Date(currentDate.getFullYear() + (direction === "next" ? 1 : -1), currentDate.getMonth(), 1))
  }

  const navigateMonth = (direction: "prev" | "next") => {
    if (selectedMonth) {
      setSelectedMonth(
        new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + (direction === "next" ? 1 : -1), 1),
      )
    }
  }

  const handleMonthClick = (month: Date) => {
    setSelectedMonth(month)
    setCalendarView("month")
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setShowAddEventDialog(true)
  }

  const backToYear = () => {
    setCalendarView("year")
    setSelectedMonth(null)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"><CheckCircle className="h-4 w-4" /> Approuvé</Badge>
        )
      case "pending":
        return (
          <Badge className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
            <Clock className="h-4 w-4" /> En attente
          </Badge>
        )
      case "rejected":
        return <Badge className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"><XCircle className="h-4 w-4" /> Refusé</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500 dark:bg-green-600"
      case "pending":
        return "bg-yellow-500 dark:bg-yellow-600"
      case "rejected":
        return "bg-red-500 dark:bg-red-600"
      default:
        return "bg-gray-500 dark:bg-gray-600"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return "Heure non précisée"
    return timeString.slice(0, 5)
  }

  const pendingEvents = events.filter((e) => e.status === "pending")
  const pendingCount = pendingEvents.length

  const monthNames = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ]

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-lg text-gray-900 dark:text-gray-100">Chargement des événements...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          📅 Gestion du Calendrier
        </h2>
        <div className="flex items-center space-x-4">
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-lg px-4 py-2">
              {pendingCount} événement{pendingCount > 1 ? "s" : ""} en attente
            </Badge>
          )}
        </div>
      </div>

      {/* Navigation entre vues */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <Button
          variant={activeView === "calendar" ? "default" : "outline"}
          onClick={() => setActiveView("calendar")}
          className={`text-sm md:text-lg px-4 md:px-8 py-3 md:py-4 h-auto rounded-xl transition-all duration-200 w-full sm:w-auto whitespace-nowrap ${
            activeView === "calendar"
              ? "bg-red-600 text-white shadow-lg hover:bg-red-700"
              : "border-2 hover:bg-gray-50 bg-white border-gray-300"
          }`}
        >
          <Calendar className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          Vue Calendrier
        </Button>
        <Button
          variant={activeView === "list" ? "default" : "outline"}
          onClick={() => setActiveView("list")}
          className={`text-sm md:text-lg px-4 md:px-8 py-3 md:py-4 h-auto rounded-xl transition-all duration-200 w-full sm:w-auto whitespace-nowrap ${
            activeView === "list"
              ? "bg-red-600 text-white shadow-lg hover:bg-red-700"
              : "border-2 hover:bg-gray-50 bg-white border-gray-300"
          }`}
        >
          <Clock className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          Liste des Événements
        </Button>
        <Button
          variant={activeView === "pending" ? "default" : "outline"}
          onClick={() => setActiveView("pending")}
          className={`text-sm md:text-lg px-4 md:px-8 py-3 md:py-4 h-auto rounded-xl transition-all duration-200 relative w-full sm:w-auto whitespace-nowrap ${
            activeView === "pending"
              ? "bg-orange-600 text-white shadow-lg hover:bg-orange-700"
              : "border-2 hover:bg-gray-50 bg-white border-gray-300"
          }`}
        >
          <Bell className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          Événements en attente
          {pendingCount > 0 && (
            <Badge className="ml-2 bg-orange-500 text-white">
              {pendingCount}
            </Badge>
          )}
        </Button>
      </div>

      {activeView === "calendar" ? (
        /* Vue Calendrier */
        <>
          {calendarView === "year" ? (
            /* Vue Année */
            <Card className="border-0 shadow-xl bg-white dark:bg-gray-800">
              <CardHeader className="pb-4 px-3 md:px-6">
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigateYear("prev")}
                    className="border-2 rounded-xl bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 px-2 md:px-4"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white text-center">
                    Année {currentDate.getFullYear()}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => navigateYear("next")}
                    className="border-2 rounded-xl bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 px-2 md:px-4"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-2 md:px-6">
                {/* Grille des mois */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                  {getMonthsInYear().map((month, index) => {
                    const monthEvents = getEventsForMonth(month)

                    return (
                      <div
                        key={index}
                        onClick={() => handleMonthClick(month)}
                        className="min-h-[100px] md:min-h-[120px] p-3 md:p-4 border rounded-xl cursor-pointer transition-all duration-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-md border-gray-200 dark:border-gray-600"
                      >
                        <div className="font-semibold text-base md:text-lg mb-2 text-gray-900 dark:text-white">
                          {monthNames[month.getMonth()]}
                        </div>
                        {monthEvents.length > 0 ? (
                          <div className="text-center">
                            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                              {monthEvents.length}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              événement{monthEvents.length > 1 ? "s" : ""}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 dark:text-gray-500 italic text-center mt-4">
                            Aucun événement
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Vue Mois */
            <Card className="border-0 shadow-xl bg-white dark:bg-gray-800">
              <CardHeader className="pb-4 px-3 md:px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={backToYear}
                    className="border-2 rounded-xl bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 w-full sm:w-auto"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigateMonth("prev")}
                      className="border-2 rounded-xl bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 px-2 md:px-4"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white text-center min-w-[200px]">
                      {selectedMonth && `${monthNames[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`}
                    </h3>
                    <Button
                      variant="outline"
                      onClick={() => navigateMonth("next")}
                      className="border-2 rounded-xl bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 px-2 md:px-4"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="hidden sm:block w-20"></div> {/* Spacer pour centrer */}
                </div>
              </CardHeader>
              <CardContent className="px-2 md:px-6">
                {/* En-têtes des jours */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center font-semibold text-gray-600 dark:text-gray-300 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Grille du calendrier mensuel */}
                <div className="grid grid-cols-7 gap-2">
                  {getDaysInMonth().map((dayInfo, index) => {
                    const dayEvents = getEventsForDate(dayInfo.date)
                    const isToday = dayInfo.date.toDateString() === new Date().toDateString() && dayInfo.isCurrentMonth

                    return (
                      <div
                        key={index}
                        onClick={() => dayInfo.isCurrentMonth && handleDateClick(dayInfo.date)}
                        className={`
                          min-h-[100px] p-2 border rounded-xl cursor-pointer transition-all duration-200
                          ${
                            dayInfo.isCurrentMonth
                              ? "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                              : "bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                          }
                          ${
                            isToday
                              ? "border-red-600 bg-red-50 dark:bg-red-900/20"
                              : "border-gray-200 dark:border-gray-600"
                          }
                          hover:shadow-md
                        `}
                      >
                        <div className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">
                          {dayInfo.date.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div
                              key={event.id}
                              className={`text-xs p-1 rounded text-white truncate ${getStatusColor(event.status)}`}
                              title={`${event.title} - ${event.status}`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              +{dayEvents.length - 2} autre(s)
                            </div>
                          )}
                          {dayEvents.length === 0 && dayInfo.isCurrentMonth && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 italic">Cliquer pour ajouter</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : activeView === "list" ? (
        /* Vue Liste */
        <div className="space-y-6">
          {events.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <CardContent className="p-12 text-center text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-xl mb-2 dark:text-gray-300">Aucun événement trouvé</p>
                <p className="text-lg">Les événements apparaîtront ici</p>
              </CardContent>
            </Card>
          ) : (
            events.map((event) => (
              <Card key={event.id} className="border-0 shadow-xl bg-white dark:bg-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{event.title}</h3>
                        {getStatusBadge(event.status)}
                      </div>
                      <div className="space-y-2 text-gray-600 dark:text-gray-400">
                        <p className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(event.event_date)}</span>
                        </p>
                        <p className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatTime(event.event_time)} • {event.duration_minutes} minutes
                          </span>
                        </p>
                        {event.description && (
                          <p className="text-gray-700 dark:text-gray-300 mt-2">{event.description}</p>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Créé par {event.created_by_name} ({event.created_by_email})
                        </p>
                        {event.status === "rejected" && event.rejection_reason && (
                          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-red-700 dark:text-red-400 font-medium">Raison du refus :</p>
                            <p className="text-red-600 dark:text-red-400">{event.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 ml-4">
                      {event.status === "pending" && (
                        <>
                          <Button
                            onClick={() => approveEvent(event.id)}
                            className="bg-green-600 hover:bg-green-700 rounded-xl"
                            size="sm"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Approuver
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedEventId(event.id)
                              setShowRejectionDialog(true)
                            }}
                            variant="outline"
                            className="border-2 text-red-600 hover:bg-red-50 rounded-xl bg-white border-red-600"
                            size="sm"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Refuser
                          </Button>
                        </>
                      )}
                      {event.status === "approved" && (
                        <Button
                          onClick={() => {
                            setSelectedEventId(event.id)
                            setShowReminderDialog(true)
                          }}
                          variant="outline"
                          className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300"
                          size="sm"
                        >
                          <Bell className="mr-2 h-4 w-4" />
                          Rappel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* Vue Événements en attente */
        <div className="space-y-6">
          {pendingEvents.length === 0 ? (
            <Card className="border-2 border-dashed border-orange-300 bg-orange-50">
              <CardContent className="p-12 text-center text-orange-600">
                <Bell className="h-16 w-16 mx-auto mb-4" />
                <p className="text-xl mb-2">Aucun événement en attente</p>
                <p className="text-lg">Tous les événements proposés ont été traités</p>
              </CardContent>
            </Card>
          ) : (
            pendingEvents.map((event) => (
              <Card key={event.id} className="border-2 border-orange-200 shadow-xl bg-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                        <Badge className="bg-orange-500 text-white">EN ATTENTE</Badge>
                      </div>
                      <div className="space-y-2 text-gray-600">
                        <p className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(event.event_date)}</span>
                        </p>
                        <p className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatTime(event.event_time)} • {event.duration_minutes} minutes
                          </span>
                        </p>
                        {event.description && (
                          <p className="text-gray-700 mt-2">{event.description}</p>
                        )}
                        <p className="text-sm text-gray-500">
                          Proposé par {event.created_by_name} ({event.created_by_email})
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 ml-4">
                      <Button
                        onClick={() => approveEvent(event.id)}
                        className="bg-green-600 hover:bg-green-700 rounded-xl w-full sm:w-auto"
                        size="sm"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approuver
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedEventId(event.id)
                          setShowRejectionDialog(true)
                        }}
                        variant="outline"
                        className="border-2 text-red-600 hover:bg-red-50 rounded-xl bg-white border-red-600 w-full sm:w-auto"
                        size="sm"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Refuser
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Dialog pour ajouter un événement */}
      <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
        <DialogContent className="sm:max-w-md bg-white max-h-[90vh] overflow-y-auto" aria-describedby="add-event-description">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
              <Plus className="h-6 w-6 text-red-600" />
              <span>Nouvel Événement</span>
            </DialogTitle>
            <DialogDescription id="add-event-description" className="text-lg text-gray-600">
              {selectedDate ? (
                <>
                  Date sélectionnée :{" "}
                  <strong>
                    {selectedDate.toLocaleDateString("fr-FR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </strong>
                </>
              ) : "Sélectionnez les détails de l'événement"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Titre de l'événement"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              className="text-lg border-2 rounded-xl bg-white text-gray-900"
            />
            <Textarea
              placeholder="Description (optionnelle)"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              className="text-lg border-2 rounded-xl bg-white text-gray-900"
              rows={3}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Heure</label>
                <Input
                  type="time"
                  value={newEvent.event_time}
                  onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                  className="border-2 rounded-xl bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Durée (min)</label>
                <Input
                  type="number"
                  value={newEvent.duration_minutes}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, duration_minutes: Number.parseInt(e.target.value) || 60 })
                  }
                  min="15"
                  max="480"
                  className="border-2 rounded-xl bg-white text-gray-900"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddEventDialog(false)
                setSelectedDate(null)
              }}
              className="text-sm md:text-lg px-4 md:px-6 bg-white border border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <XCircle className="h-5 w-5" /> Annuler
            </Button>
            <Button onClick={addEvent} className="bg-red-600 hover:bg-red-700 text-sm md:text-lg px-4 md:px-6 flex items-center justify-center gap-2 w-full sm:w-auto">
              <CheckCircle className="h-5 w-5" /> Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de refus */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="sm:max-w-md bg-white" aria-describedby="rejection-description">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <X className="h-6 w-6 text-red-600" />
              <span>Refuser l'événement</span>
            </DialogTitle>
            <DialogDescription id="rejection-description" className="text-lg text-gray-600">
              Veuillez indiquer la raison du refus :
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Raison du refus..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="text-lg border-2 rounded-xl bg-white text-gray-900"
            rows={3}
          />
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectionDialog(false)
                setRejectionReason("")
                setSelectedEventId(null)
              }}
              className="text-lg px-6 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
            >
              <XCircle className="h-5 w-5" /> Annuler
            </Button>
            <Button
              onClick={() => selectedEventId && rejectEvent(selectedEventId, rejectionReason)}
              className="bg-red-600 hover:bg-red-700 text-lg px-6"
              disabled={!rejectionReason.trim()}
            >
              <X className="mr-2 h-4 w-4" />
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rappel */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent className="sm:max-w-md bg-white" aria-describedby="reminder-description">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <Bell className="h-6 w-6 text-red-600" />
              <span>Programmer un rappel</span>
            </DialogTitle>
            <DialogDescription id="reminder-description" className="text-lg text-gray-600">
              Configurez les paramètres du rappel par email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Envoyer le rappel
              </label>
              <Select
                value={reminderSettings.days_before.toString()}
                onValueChange={(value) =>
                  setReminderSettings({ ...reminderSettings, days_before: Number.parseInt(value) })
                }
              >
                <SelectTrigger className="border-2 rounded-xl bg-white text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 jour avant</SelectItem>
                  <SelectItem value="2">2 jours avant</SelectItem>
                  <SelectItem value="3">3 jours avant</SelectItem>
                  <SelectItem value="7">1 semaine avant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Destinataires</label>
              <Select
                value={reminderSettings.recipient_type}
                onValueChange={(value) =>
                  setReminderSettings({
                    ...reminderSettings,
                    recipient_type: value as "all" | "admins" | "employees",
                  })
                }
              >
                <SelectTrigger className="border-2 rounded-xl bg-white text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout le monde</SelectItem>
                  <SelectItem value="admins">Administrateurs seulement</SelectItem>
                  <SelectItem value="employees">Employés seulement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Message personnalisé (optionnel)
              </label>
              <Textarea
                placeholder="Message supplémentaire..."
                value={reminderSettings.custom_message}
                onChange={(e) => setReminderSettings({ ...reminderSettings, custom_message: e.target.value })}
                className="text-lg border-2 rounded-xl bg-white text-gray-900"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowReminderDialog(false)
                setReminderSettings({
                  days_before: 1,
                  recipient_type: "all",
                  custom_message: "",
                })
                setSelectedEventId(null)
              }}
              className="text-lg px-6 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
            >
              <XCircle className="h-5 w-5" /> Annuler
            </Button>
            <Button
              onClick={() => selectedEventId && addReminder(selectedEventId)}
              className="bg-red-600 hover:bg-red-700 text-lg px-6"
            >
              <Bell className="mr-2 h-4 w-4" />
              Programmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
