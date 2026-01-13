"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, Check, X, ChevronLeft, ChevronRight, Plus, ArrowLeft, Bell } from "lucide-react"
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
  const [activeView, setActiveView] = useState<"calendar" | "list">("calendar")
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
      console.error("Erreur lors du chargement des événements:", error)
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
      console.error("Erreur lors du chargement des événements du mois:", error)
    }
  }

  useEffect(() => {
    if (calendarView === "year") {
      loadEvents()
    } else if (selectedMonth) {
      loadMonthEvents()
    }
  }, [currentDate, calendarView, selectedMonth])

  // Rafraîchissement automatique toutes les 5 secondes
  useAutoRefresh(() => {
    if (calendarView === "year") {
      loadEvents()
    } else if (selectedMonth) {
      loadMonthEvents()
    }
  }, 5000, [calendarView, selectedMonth])

  const addEvent = async () => {
    if (!newEvent.title || !selectedDate) return

    try {
      const userEmail = localStorage.getItem("userEmail") || ""
      const userName = localStorage.getItem("userName") || ""

      const { data, error } = await supabase
        .from("calendar_events")
        .insert([
          {
            title: newEvent.title,
            description: newEvent.description,
            event_date: selectedDate.toISOString().split("T")[0],
            event_time: newEvent.event_time || null,
            duration_minutes: newEvent.duration_minutes,
            created_by_email: userEmail,
            created_by_name: userName,
            status: "approved", // Les admins créent des événements directement approuvés
          },
        ])
        .select()

      if (error) throw error

      if (data) {
        setEvents([...events, ...data])
      }

      setNewEvent({
        title: "",
        description: "",
        event_time: "",
        duration_minutes: 60,
      })
      setShowAddEventDialog(false)
      setSelectedDate(null)

      alert("✅ Événement créé avec succès !")
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

      alert("✅ Événement approuvé avec succès !")
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
      alert("❌ Événement refusé")
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
      alert("✅ Rappel programmé avec succès !")
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
    const dateString = date.toISOString().split("T")[0]
    return events.filter((event) => event.event_date === dateString)
  }

  const getDaysInMonth = () => {
    if (!selectedMonth) return []

    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    // Jours du mois précédent
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      days.push({ date: prevDate, isCurrentMonth: false })
    }

    // Jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push({ date, isCurrentMonth: true })
    }

    // Jours du mois suivant
    const remainingDays = 42 - days.length
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
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">✅ Approuvé</Badge>
        )
      case "pending":
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
            ⏳ En attente
          </Badge>
        )
      case "rejected":
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">❌ Refusé</Badge>
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

  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

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
        <h2 className="text-3xl font-bold text-gray-900">
          📅 Gestion du Calendrier
        </h2>
        <div className="flex items-center space-x-4">
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 text-lg px-4 py-2">
              {pendingCount} événement{pendingCount > 1 ? "s" : ""} en attente
            </Badge>
          )}
        </div>
      </div>

      {/* Navigation entre vues */}
      <div className="flex space-x-4">
        <Button
          variant={activeView === "calendar" ? "default" : "outline"}
          onClick={() => setActiveView("calendar")}
          className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
            activeView === "calendar"
              ? "bg-red-600 text-white shadow-lg hover:bg-red-700"
              : "border-2 hover:bg-gray-50 bg-white border-gray-300"
          }`}
        >
          <Calendar className="mr-2 h-5 w-5" />
          Vue Calendrier
        </Button>
        <Button
          variant={activeView === "list" ? "default" : "outline"}
          onClick={() => setActiveView("list")}
          className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
            activeView === "list"
              ? "bg-red-600 text-white shadow-lg hover:bg-red-700"
              : "border-2 hover:bg-gray-50 bg-white border-gray-300"
          }`}
        >
          <Clock className="mr-2 h-5 w-5" />
          Liste des Événements
        </Button>
      </div>

      {activeView === "calendar" ? (
        /* Vue Calendrier */
        <>
          {calendarView === "year" ? (
            /* Vue Année */
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => navigateYear("prev")}
                    className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Année {currentDate.getFullYear()}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => navigateYear("next")}
                    className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Grille des mois */}
                <div className="grid grid-cols-3 gap-4">
                  {getMonthsInYear().map((month, index) => {
                    const monthEvents = getEventsForMonth(month)

                    return (
                      <div
                        key={index}
                        onClick={() => handleMonthClick(month)}
                        className="min-h-[120px] p-4 border rounded-xl cursor-pointer transition-all duration-200 bg-white hover:bg-gray-50 hover:shadow-md border-gray-200"
                      >
                        <div className="font-semibold text-lg mb-2 text-gray-900">
                          {monthNames[month.getMonth()]}
                        </div>
                        <div className="space-y-1">
                          {monthEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={`text-xs p-1 rounded text-white truncate ${getStatusColor(event.status)}`}
                              title={`${event.title} - ${event.status}`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {monthEvents.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{monthEvents.length - 3} autre(s)
                            </div>
                          )}
                          {monthEvents.length === 0 && (
                            <div className="text-xs text-gray-400 italic">Cliquer pour voir</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Vue Mois */
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={backToYear}
                    className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => navigateMonth("prev")}
                      className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedMonth && `${monthNames[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`}
                    </h3>
                    <Button
                      variant="outline"
                      onClick={() => navigateMonth("next")}
                      className="border-2 rounded-xl bg-white hover:bg-gray-50 border-gray-300"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="w-20"></div> {/* Spacer pour centrer */}
                </div>
              </CardHeader>
              <CardContent>
                {/* En-têtes des jours */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center font-semibold text-gray-600 py-2">
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
                              ? "bg-white hover:bg-gray-50"
                              : "bg-gray-50 text-gray-400"
                          }
                          ${
                            isToday
                              ? "border-red-600 bg-red-50"
                              : "border-gray-200"
                          }
                          hover:shadow-md
                        `}
                      >
                        <div className="font-semibold text-sm mb-1 text-gray-900">
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
                            <div className="text-xs text-gray-500">
                              +{dayEvents.length - 2} autre(s)
                            </div>
                          )}
                          {dayEvents.length === 0 && dayInfo.isCurrentMonth && (
                            <div className="text-xs text-gray-400 italic">Cliquer pour ajouter</div>
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
      ) : (
        /* Vue Liste */
        <div className="space-y-6">
          {events.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-12 text-center text-gray-500">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-xl mb-2">Aucun événement trouvé</p>
                <p className="text-lg">Les événements apparaîtront ici</p>
              </CardContent>
            </Card>
          ) : (
            events.map((event) => (
              <Card key={event.id} className="border-0 shadow-xl bg-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                        {getStatusBadge(event.status)}
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
                          Créé par {event.created_by_name} ({event.created_by_email})
                        </p>
                        {event.status === "rejected" && event.rejection_reason && (
                          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                            <p className="text-red-700 font-medium">Raison du refus :</p>
                            <p className="text-red-600">{event.rejection_reason}</p>
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
      )}

      {/* Dialog pour ajouter un événement */}
      <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <Plus className="h-6 w-6 text-red-600" />
              <span>Nouvel Événement</span>
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
              {selectedDate && (
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
              )}
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
            <div className="grid grid-cols-2 gap-4">
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
          <DialogFooter className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddEventDialog(false)
                setSelectedDate(null)
              }}
              className="text-lg px-6 bg-white border border-gray-300 hover:bg-gray-50"
            >
              ❌ Annuler
            </Button>
            <Button onClick={addEvent} className="bg-red-600 hover:bg-red-700 text-lg px-6">
              ✅ Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de refus */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <X className="h-6 w-6 text-red-600" />
              <span>Refuser l'événement</span>
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
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
              className="text-lg px-6 bg-white border border-gray-300 hover:bg-gray-50"
            >
              ❌ Annuler
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
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <Bell className="h-6 w-6 text-red-600" />
              <span>Programmer un rappel</span>
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
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
              className="text-lg px-6 bg-white border border-gray-300 hover:bg-gray-50"
            >
              ❌ Annuler
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
