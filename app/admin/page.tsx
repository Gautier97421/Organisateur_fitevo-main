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
import { useRouter } from "next/navigation"
import { ClipboardList, Building2, Users, Calendar, CalendarDays, Activity, UserPlus, Shield, LogOut } from "lucide-react"

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
    { id: "tasks", label: "Tâches", icon: ClipboardList, component: <TaskManager /> },
    { id: "gyms", label: "Salles", icon: Building2, component: <GymManager /> },
    { id: "employees", label: "Utilisateurs", icon: Users, component: <EmployeeManager /> },
    { id: "schedule", label: "Planning", icon: Calendar, component: <WorkScheduleManager /> },
    { id: "calendar", label: "Événements", icon: CalendarDays, component: <CalendarManager /> },
    { id: "monitor", label: "Suivi", icon: Activity, component: <RealTimeMonitor /> },
    { id: "newmember", label: "Nouveau Adhérent", icon: UserPlus, component: <NewMemberManager /> },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-red-600 dark:bg-red-700 shadow-md border-b border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-7xl mx-auto gap-4">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-lg flex items-center justify-center shadow">
              <Shield className="w-6 h-6 md:w-7 md:h-7 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                Administration
              </h1>
              <p className="text-sm md:text-base text-gray-100 truncate max-w-[200px] sm:max-w-none">
                {userName} • {userEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3 w-full sm:w-auto">
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-2 border-white hover:bg-white hover:text-red-600 bg-white text-red-600 text-sm md:text-base flex-1 sm:flex-none"
            >
              <LogOut className="mr-2 h-4 w-4" />
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
                  ? "bg-red-600 hover:bg-red-700 text-white shadow dark:bg-red-700 dark:hover:bg-red-800"
                  : "border border-gray-300 hover:bg-gray-50 bg-white text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Contenu */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          {tabs.find((tab) => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  )
}
