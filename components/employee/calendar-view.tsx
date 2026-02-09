"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, ArrowLeft, CheckCircle, XCircle } from "lucide-react"
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
}

export function CalendarView({ hasWorkScheduleAccess = true }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [activeView, setActiveView] = useState<"events" | "schedule">("events")
  const [calendarView, setCalendarView] = useState<"year" | "month">("year")
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    event_time: "",
    duration_minutes: 60,
  })

  // S'assurer que activeView est "events" si pas d'accès au planning
  useEffect(() => {
    if (!hasWorkScheduleAccess && activeView === "schedule") {
      setActiveView("events")
    }
  }, [hasWorkScheduleAccess, activeView])

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
          },
        ])

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
      setShowEventDialog(false)
      setSelectedDate(null)

      alert("Événement proposé ! Il sera visible une fois approuvé par un administrateur.")
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error)
      alert("Erreur lors de l'ajout de l'événement")
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
    return events.filter((event) => {
      const eventDate = new Date(event.event_date).toISOString().split("T")[0]
      return eventDate === dateString
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">
          <Calendar className="h-5 w-5 inline-block mr-2" />
          Calendrier & Planning
        </h2>
      </div>

      {/* Navigation entre vues */}
      <div className="flex space-x-4">
        <Button
          variant={activeView === "events" ? "default" : "outline"}
          onClick={() => setActiveView("events")}
          className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
            activeView === "events"
              ? "bg-red-600 text-white shadow-lg"
              : "border-2 border-gray-300 hover:bg-gray-50 bg-white"
          }`}
        >
          <Calendar className="mr-2 h-5 w-5" />
          Événements Annuels
        </Button>
        {hasWorkScheduleAccess && (
          <Button
            variant={activeView === "schedule" ? "default" : "outline"}
            onClick={() => setActiveView("schedule")}
            className={`text-lg px-8 py-4 h-auto rounded-xl transition-all duration-200 ${
              activeView === "schedule"
                ? "bg-red-600 text-white shadow-lg"
                : "border-2 border-gray-300 hover:bg-gray-50 bg-white"
            }`}
          >
            <Clock className="mr-2 h-5 w-5" />
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
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => navigateYear("prev")}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Année {currentDate.getFullYear()}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => navigateYear("next")}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50"
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
                    const isPastMonth = month < new Date(new Date().getFullYear(), new Date().getMonth(), 1)

                    return (
                      <div
                        key={index}
                        onClick={() => !isPastMonth && handleMonthClick(month)}
                        className={`
                          min-h-[120px] p-4 border rounded-xl cursor-pointer transition-all duration-200
                          ${
                            isPastMonth
                              ? "bg-gray-50 text-gray-400 cursor-not-allowed opacity-50"
                              : "bg-white hover:bg-red-50 hover:shadow-md"
                          }
                          border-gray-200
                        `}
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
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={backToYear}
                    className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => navigateMonth("prev")}
                      className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedMonth && `${monthNames[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`}
                    </h3>
                    <Button
                      variant="outline"
                      onClick={() => navigateMonth("next")}
                      className="border-2 border-gray-300 rounded-xl bg-white hover:bg-gray-50"
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
                    const isPast = dayInfo.date < new Date() && dayInfo.isCurrentMonth

                    return (
                      <div
                        key={index}
                        onClick={() => dayInfo.isCurrentMonth && !isPast && handleDateClick(dayInfo.date)}
                        className={`
                          min-h-[100px] p-2 border rounded-xl cursor-pointer transition-all duration-200
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
                          ${isPast ? "cursor-not-allowed opacity-50" : "hover:shadow-md"}
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
          <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
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
              <DialogFooter className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEventDialog(false)
                    setSelectedDate(null)
                  }}
                  className="text-lg px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-2"
                >
                  <XCircle className="h-5 w-5" /> Annuler
                </Button>
                <Button onClick={addEvent} className="bg-red-600 hover:bg-red-700 text-lg px-6 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" /> Proposer
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
