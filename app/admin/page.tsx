"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { TaskManager } from "@/components/admin/task-manager"
import { EmployeeManager } from "@/components/admin/employee-manager"
import { RealTimeMonitor } from "@/components/admin/real-time-monitor"
import { CalendarManager } from "@/components/admin/calendar-manager"
import { GymManager } from "@/components/admin/gym-manager"
import { WorkScheduleManager } from "@/components/admin/work-schedule-manager"
import { NewMemberManager } from "@/components/admin/new-member-manager"
import { ThemeToggle } from "@/components/theme-toggle"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("tasks")
  const [userEmail, setUserEmail] = useState("")
  const [userName, setUserName] = useState("")
  const router = useRouter()

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || ""
    const name = localStorage.getItem("userName") || ""
    setUserEmail(email)
    setUserName(name)
  }, [])

  const handleLogout = () => {
    localStorage.clear()
    router.push("/")
  }

  const tabs = [
    { id: "tasks", label: "📝 Tâches", component: <TaskManager /> },
    { id: "gyms", label: "🏢 Salles", component: <GymManager /> },
    { id: "employees", label: "👥 Utilisateurs", component: <EmployeeManager /> },
    { id: "schedule", label: "📅 Planning", component: <WorkScheduleManager /> },
    { id: "calendar", label: "🗓️ Événements", component: <CalendarManager /> },
    { id: "monitor", label: "📊 Suivi", component: <RealTimeMonitor /> },
    { id: "newmember", label: "🆕 Nouveau Adhérent", component: <NewMemberManager /> },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-black shadow-md border-b border-gray-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-7xl mx-auto gap-4">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-lg flex items-center justify-center shadow">
              <span className="text-xl md:text-2xl">👨‍💼</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                Administration
              </h1>
              <p className="text-sm md:text-base text-gray-200 truncate max-w-[200px] sm:max-w-none">
                {userName} • {userEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3 w-full sm:w-auto">
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-2 border-white hover:bg-white/10 text-white text-sm md:text-base flex-1 sm:flex-none"
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Navigation */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              variant={activeTab === tab.id ? "default" : "outline"}
              size="sm"
              className={`text-sm md:text-base px-4 md:px-6 py-2 md:py-3 h-auto transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-red-600 hover:bg-red-700 text-white shadow"
                  : "border border-gray-300 hover:bg-gray-50 bg-white text-gray-700"
              }`}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Contenu */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 md:p-6">
          {tabs.find((tab) => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  )
}
