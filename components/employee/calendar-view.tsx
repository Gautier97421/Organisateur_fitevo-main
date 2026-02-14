"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, ArrowLeft, CheckCircle, XCircle, CalendarDays, Edit2, Trash2, MapPin } from "lucide-react"
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
import { WorkScheduleCalendar } from "./work-schedule-calendar"

interface CalendarEvent {
  id: string
  title: string
  description?: string
  location: string
  event_date: string
  event_time?: string
  duration_minutes: number
  created_by_email: string
  created_by_name: string
  status: "pending" | "approved" | "rejected"
  rejection_reason?: string
}

interface CalendarViewProps {
  hasWorkScheduleAccess?: boolean
  hasCalendarAccess?: boolean
}

export function CalendarView({ hasWorkScheduleAccess = true, hasCalendarAccess = true }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [activeView, setActiveView] = useState<"events" | "schedule">(
    hasCalendarAccess ? "events" : "schedule"
  )
  const [calendarView, setCalendarView] = useState<"year" | "month">("year")
  const [showDayEventsDialog, setShowDayEventsDialog] = useState(false)
  const [selectedDayForDetails, setSelectedDayForDetails] = useState<Date | null>(null)
  const [showEditEventDialog, setShowEditEventDialog] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null)
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null)
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    location: "",
    event_time: "",
    duration_minutes: 60,
  })

  // S'assurer que activeView est correct selon les permissions
  useEffect(() => {
    if (!hasWorkScheduleAccess && activeView === "schedule") {
      setActiveView("events")
    }
    if (!hasCalendarAccess && activeView === "events") {
      setActiveView("schedule")
    }
  }, [hasWorkScheduleAccess, hasCalendarAccess, activeView])

  const loadEvents = async () => {
    try {
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1)
      const endOfYear = new Date(currentDate.getFullYear(), 11, 31)

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", startOfYear.toISOString().split("T")[0])
        .lte("event_date", endOfYear.toISOString().split("T")[0])

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error("Erreur lors du chargement des événements:", error)
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

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      // Erreur silencieuse
    }
  }

  useEffect(() => {
    if (activeView === "events") {
      if (calendarView === "year") {
        loadEvents()
      } else if (selectedMonth) {
        loadMonthEvents()
      }
    }
  }, [currentDate, activeView, calendarView, selectedMonth])

  // Rafraîchissement automatique toutes les 5 secondes
  useAutoRefresh(() => {
    if (activeView === "events") {
      if (calendarView === "year") {
        loadEvents()
      } else if (selectedMonth) {
        loadMonthEvents()
      }
    }
  }, 5000, [activeView, calendarView, selectedMonth])

  const addEvent = async () => {
    // Marquer qu'on a tenté de soumettre
    setAttemptedSubmit(true)
    setErrorMessage("")
    
    // Validation des champs obligatoires
    if (!newEvent.title || !newEvent.location || !selectedDate) {
      setErrorMessage("⚠️ Saisie incomplète : veuillez remplir tous les champs obligatoires")
      return
    }

    // Valider que selectedDate est une date valide
    if (!(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
      setErrorMessage("❌ Date invalide. Veuillez sélectionner une date correcte.")
      return
    }

    try {
      const userEmail = localStorage.getItem("userEmail") || ""
      const userName = localStorage.getItem("userName") || ""
      const userId = localStorage.getItem("userId") || ""

      console.log("Débug création événement:", { userEmail, userName, userId }) // Debug

      const { error } = await supabase
        .from("calendar_events")
        .insert([{
          title: newEvent.title,
          description: newEvent.description,
          location: newEvent.location,
          event_date: selectedDate.toISOString().split("T")[0],
          event_time: newEvent.event_time || null,
          duration_minutes: newEvent.duration_minutes,
          created_by_email: userEmail,
          created_by_name: userName,
          user_id: userId,
        }])

      if (error) {
        setErrorMessage("❌ Erreur lors de l'enregistrement. Veuillez réessayer.")
        return
      }

      // Recharger les événements pour afficher le nouvel événement
      if (calendarView === "year") {
        await loadEvents()
      } else if (selectedMonth) {
        await loadMonthEvents()
      }

      setNewEvent({
        title: "",
        description: "",
        location: "",
        event_time: "",
        duration_minutes: 60,
      })
      setShowEventDialog(false)
      setSelectedDate(null)
      setAttemptedSubmit(false)
      setErrorMessage("")
    } catch (error) {
      setErrorMessage("❌ Erreur lors de l'enregistrement. Veuillez réessayer.")
    }
  }

  const handleEditEvent = async () => {
    if (!eventToEdit) return

    setAttemptedSubmit(true)
    setErrorMessage("")

    if (!newEvent.title || !newEvent.location) {
      setErrorMessage("⚠️ Saisie incomplète : veuillez remplir tous les champs obligatoires")
      return
    }

    try {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          title: newEvent.title,
          description: newEvent.description,
          location: newEvent.location,
          event_time: newEvent.event_time || null,
          duration_minutes: newEvent.duration_minutes,
        })
        .eq("id", eventToEdit.id)

      if (error) {
        setErrorMessage("❌ Erreur lors de la modification. Veuillez réessayer.")
        return
      }

      if (calendarView === "year") {
        await loadEvents()
      } else if (selectedMonth) {
        await loadMonthEvents()
      }

      setShowEditEventDialog(false)
      setEventToEdit(null)
      setNewEvent({ title: "", description: "", location: "", event_time: "", duration_minutes: 60 })
      setAttemptedSubmit(false)
      setErrorMessage("")
    } catch (error) {
      setErrorMessage("❌ Erreur lors de la modification. Veuillez réessayer.")
    }
  }

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return

    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventToDelete.id)

      if (error) {
        setErrorMessage("❌ Erreur lors de la suppression. Veuillez réessayer.")
        return
      }

      if (calendarView === "year") {
        await loadEvents()
      } else if (selectedMonth) {
        await loadMonthEvents()
      }

      setShowDeleteConfirmDialog(false)
      setEventToDelete(null)
    } catch (error) {
      setErrorMessage("❌ Erreur lors de la suppression. Veuillez réessayer.")
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
      try {
        const eventDate = new Date(event.event_date)
        if (isNaN(eventDate.getTime())) return false
        return eventDate >= startOfMonth && eventDate <= endOfMonth
      } catch {
        return false
      }
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
    setShowEventDialog(true)
  }

  const backToYear = () => {
    setCalendarView("year")
    setSelectedMonth(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500"
      case "pending":
        return "bg-yellow-500"
      case "rejected":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getDaysInMonth = () => {
    if (!selectedMonth) return []

    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    // getDay() retourne 0 pour dimanche, on ajuste pour que lundi soit 0
    let startingDayOfWeek = firstDay.getDay() - 1
    if (startingDayOfWeek === -1) startingDayOfWeek = 6 // Si dimanche, le mettre à la fin

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {hasCalendarAccess && hasWorkScheduleAccess && (
            <>
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 inline-block mr-2" />
              Calendrier & Planning
            </>
          )}
          {!hasCalendarAccess && hasWorkScheduleAccess && (
            <>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 inline-block mr-2" />
              Planning de Travail
            </>
          )}
          {hasCalendarAccess && !hasWorkScheduleAccess && (
            <>
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 inline-block mr-2" />
              Calendrier d'Événements
            </>
          )}
        </h2>
      </div>

      {/* Navigation entre vues */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        {hasCalendarAccess && (
          <Button
            variant={activeView === "events" ? "default" : "outline"}
            onClick={() => setActiveView("events")}
            className={`text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 h-auto rounded-xl transition-all duration-200 w-full sm:w-auto whitespace-nowrap ${
              activeView === "events"
                ? "bg-red-600 text-white shadow-lg"
                : "border-2 border-gray-300 hover:bg-gray-50 bg-white"
            }`}
          >
            <Calendar className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            Événements Annuels
          </Button>
        )}
        {hasWorkScheduleAccess && (
          <Button
            variant={activeView === "schedule" ? "default" : "outline"}
            onClick={() => setActiveView("schedule")}
            className={`text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 h-auto rounded-xl transition-all duration-200 w-full sm:w-auto whitespace-nowrap ${
              activeView === "schedule"
                ? "bg-red-600 text-white shadow-lg"
                : "border-2 border-gray-300 hover:bg-gray-50 bg-white"
            }`}
          >
            <Clock className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            Planning de Travail
          </Button>
        )}
      </div>

      {activeView === "events" ? (
        /* Vue Événements Annuels */
        <>
          {calendarView === "year" ? (
            /* Vue Année */
            <Card className="border border-gray-200 shadow-xl bg-white">
              <CardHeader className="pb-4 px-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigateYear("prev")}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 px-2 sm:px-4"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
                    Année {currentDate.getFullYear()}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => navigateYear("next")}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 px-2 sm:px-4"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                {/* Grille des mois */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                  {getMonthsInYear().map((month, index) => {
                    const monthEvents = getEventsForMonth(month)
                    const isPastMonth = month < new Date(new Date().getFullYear(), new Date().getMonth(), 1)

                    return (
                      <div
                        key={index}
                        onClick={() => !isPastMonth && handleMonthClick(month)}
                        className={`
                          min-h-[80px] sm:min-h-[120px] p-2 sm:p-4 border rounded-xl cursor-pointer transition-all duration-200
                          ${
                            isPastMonth
                              ? "bg-gray-50 text-gray-400 cursor-not-allowed opacity-50"
                              : "bg-white hover:bg-red-50 hover:shadow-md"
                          }
                          border-gray-200
                        `}
                      >
                        <div className="font-semibold text-sm sm:text-lg mb-2 text-gray-900">
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
                          {monthEvents.length === 0 && !isPastMonth && (
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
            <Card className="border border-gray-200 shadow-xl bg-white">
              <CardHeader className="pb-4 px-3 sm:px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={backToYear}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 w-full sm:w-auto"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigateMonth("prev")}
                      className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 px-2 sm:px-4"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="text-lg sm:text-2xl font-bold text-gray-900 text-center min-w-[180px] sm:min-w-[200px]">
                      {selectedMonth && `${monthNames[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`}
                    </h3>
                    <Button
                      variant="outline"
                      onClick={() => navigateMonth("next")}
                      className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50 px-2 sm:px-4"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="hidden sm:block w-20"></div>
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
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
                    const isPast = dayInfo.date < new Date() && dayInfo.isCurrentMonth

                    return (
                      <div
                        key={index}
                        onClick={() => {
                          if (dayInfo.isCurrentMonth) {
                            setSelectedDayForDetails(dayInfo.date)
                            setShowDayEventsDialog(true)
                          }
                        }}
                        className={`
                          relative min-h-[100px] p-2 border rounded-xl cursor-pointer transition-all duration-200
                          ${
                            dayInfo.isCurrentMonth
                              ? "bg-white hover:bg-red-50"
                              : "bg-gray-50 text-gray-400"
                          }
                          ${
                            isToday
                              ? "border-red-500 bg-red-100"
                              : "border-gray-200"
                          }
                          ${dayInfo.isCurrentMonth ? "hover:shadow-md" : ""}
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
                          {dayEvents.length === 0 && dayInfo.isCurrentMonth && !isPast && (
                            <div className="text-xs text-gray-400 italic">Cliquer pour ajouter</div>
                          )}
                        </div>
                        {dayInfo.isCurrentMonth && !isPast && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDateClick(dayInfo.date)
                            }}
                            className="absolute bottom-1 right-1 p-0.5 bg-gray-600 hover:bg-gray-500 text-white rounded-full shadow-lg transition-all hover:scale-110"
                            title="Ajouter un événement"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Légende */}
          <Card className="border border-gray-200 shadow-xl bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-gray-700">Approuvé</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span className="text-gray-700">En attente</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-gray-700">Refusé</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dialog pour ajouter un événement */}
          <Dialog open={showEventDialog} onOpenChange={(open) => {
            setShowEventDialog(open)
            if (!open) {
              setAttemptedSubmit(false)
              setErrorMessage("")
              setSelectedDate(null)
            }
          }}>
            <DialogContent className="sm:max-w-md bg-white max-h-[90vh] overflow-y-auto" aria-describedby="add-event-description">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl flex items-center space-x-2 text-gray-900">
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                  <span>Nouvel Événement</span>
                </DialogTitle>
                <DialogDescription id="add-event-description" className="text-sm sm:text-lg text-gray-600">
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
                  ) : "Sélectionnez une date dans le calendrier"}
                </DialogDescription>
              </DialogHeader>
              
              {errorMessage && (
                <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 mb-4">
                  <p className="text-red-700 text-sm font-medium text-center">{errorMessage}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Titre de l'événement <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Titre de l'événement"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className={`text-lg border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newEvent.title ? 'border-red-500 focus:border-red-600' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Lieu <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Lieu de l'événement"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className={`text-lg border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newEvent.location ? 'border-red-500 focus:border-red-600' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Description <span className="text-gray-500 text-xs">(optionnel)</span>
                  </label>
                  <Textarea
                    placeholder="Description (optionnelle)"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="text-lg border-2 rounded-xl bg-white text-gray-900"
                    rows={3}
                  />
                </div>
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
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Durée (min)
                    </label>
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
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEventDialog(false)
                    setSelectedDate(null)
                    setAttemptedSubmit(false)
                    setErrorMessage("")
                  }}
                  className="text-sm sm:text-lg px-4 sm:px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-2 w-full sm:w-auto"
                >
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5" /> Annuler
                </Button>
                <Button onClick={addEvent} className="bg-red-600 hover:bg-red-700 text-sm sm:text-lg px-4 sm:px-6 flex items-center gap-2 w-full sm:w-auto">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" /> Proposer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog de détails du jour */}
          <Dialog open={showDayEventsDialog} onOpenChange={setShowDayEventsDialog}>
            <DialogContent className="sm:max-w-2xl bg-white max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center space-x-2 text-gray-900">
                  <CalendarDays className="h-6 w-6 text-red-600" />
                  <span>
                    Événements du {selectedDayForDetails && new Date(selectedDayForDetails).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {selectedDayForDetails && (() => {
                  const dayEvents = getEventsForDate(selectedDayForDetails).sort((a, b) => {
                    const timeA = a.event_time || "00:00"
                    const timeB = b.event_time || "00:00"
                    return timeA.localeCompare(timeB)
                  })

                  if (dayEvents.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <CalendarDays className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-lg">Aucun événement pour ce jour</p>
                      </div>
                    )
                  }

                  return dayEvents.map((event) => {
                    const userEmail = localStorage.getItem("userEmail")
                    const isOwnEvent = event.created_by_email === userEmail
                    const today = new Date().toISOString().split('T')[0]
                    const isPast = event.event_date < today
                    const canModify = isOwnEvent && event.status === "pending" && !isPast

                    return (
                      <Card
                        key={event.id}
                        className={`border-2 bg-white ${getStatusColor(event.status)} bg-opacity-10`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-bold text-lg text-gray-900">{event.title}</h4>
                              {isOwnEvent && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-white">
                                  Vous
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getStatusColor(event.status)}`}>
                              {event.status === "approved" ? "Approuvé" : event.status === "pending" ? "En attente" : "Refusé"}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span>
                                {event.event_time ? `${event.event_time.slice(0, 5)} • Durée : ${event.duration_minutes} minutes` : "Heure non précisée"}
                              </span>
                            </div>
                            {event.location && (
                              <div className="flex items-center space-x-2 mt-2">
                                <MapPin className="h-4 w-4" />
                                <span className="text-gray-700">{event.location}</span>
                              </div>
                            )}
                            {event.description && (
                              <p className="text-gray-700 mt-2">{event.description}</p>
                            )}
                            {event.status === "rejected" && event.rejection_reason && (
                              <div className="bg-red-50 p-2 rounded mt-2 border border-red-200">
                                <p className="text-red-700 font-medium text-xs">Raison du refus :</p>
                                <p className="text-red-600 text-xs">{event.rejection_reason}</p>
                              </div>
                            )}
                          </div>
                          {canModify && (
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEventToEdit(event)
                                  setNewEvent({
                                    title: event.title,
                                    description: event.description || "",
                                    location: event.location,
                                    event_time: event.event_time || "",
                                    duration_minutes: event.duration_minutes,
                                  })
                                  setShowDayEventsDialog(false)
                                  setShowEditEventDialog(true)
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                              >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Modifier
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEventToDelete(event)
                                  setShowDayEventsDialog(false)
                                  setShowDeleteConfirmDialog(true)
                                }}
                                className="border-red-600 text-red-600 hover:bg-red-50 flex-1"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Supprimer
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                })()}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => setShowDayEventsDialog(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog d'édition d'événement */}
          <Dialog open={showEditEventDialog} onOpenChange={(open) => {
            setShowEditEventDialog(open)
            if (!open) {
              setEventToEdit(null)
              setNewEvent({ title: "", description: "", location: "", event_time: "", duration_minutes: 60 })
              setAttemptedSubmit(false)
              setErrorMessage("")
            }
          }}>
            <DialogContent className="sm:max-w-md bg-white max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg md:text-xl flex items-center space-x-2 text-gray-900">
                  <Edit2 className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                  <span>Modifier l'Événement</span>
                </DialogTitle>
                <DialogDescription className="text-sm md:text-base text-gray-600">
                  {eventToEdit && (
                    <>
                      {new Date(eventToEdit.event_date).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              {errorMessage && (
                <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 mb-4">
                  <p className="text-red-700 text-sm font-medium text-center">{errorMessage}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Titre de l'événement <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Titre de l'événement"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newEvent.title ? 'border-red-500 focus:border-red-600' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Lieu <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Lieu de l'événement"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className={`border-2 rounded-xl bg-white text-gray-900 ${attemptedSubmit && !newEvent.location ? 'border-red-500 focus:border-red-600' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Description
                  </label>
                  <Textarea
                    placeholder="Description (facultatif)"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="border-2 rounded-xl bg-white text-gray-900 min-h-[80px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Heure
                    </label>
                    <Input
                      type="time"
                      value={newEvent.event_time}
                      onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                      className="border-2 rounded-xl bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Durée (min)
                    </label>
                    <Input
                      type="number"
                      value={newEvent.duration_minutes}
                      onChange={(e) => setNewEvent({ ...newEvent, duration_minutes: Number.parseInt(e.target.value) || 60 })}
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
                  onClick={() => setShowEditEventDialog(false)}
                  className="flex-1 border-2 rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleEditEvent}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog de confirmation de suppression */}
          <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center space-x-2 text-gray-900">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <span>Confirmer la suppression</span>
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Êtes-vous sûr de vouloir supprimer cet événement ?
                  {eventToDelete && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-900">{eventToDelete.title}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(eventToDelete.event_date).toLocaleDateString("fr-FR")}
                        {eventToDelete.event_time && ` - ${eventToDelete.event_time.slice(0, 5)}`}
                      </p>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirmDialog(false)}
                  className="flex-1 border-2 rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleDeleteEvent}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl"
                >
                  Supprimer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        /* Vue Planning de Travail */
        <WorkScheduleCalendar />
      )}
    </div>
  )
}
