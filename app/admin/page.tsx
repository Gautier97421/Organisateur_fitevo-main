"use client"

import { useState, useEffect, useRef } from "react"
import { TaskManager } from "@/components/admin/task-manager"
import { EmployeeManager } from "@/components/admin/employee-manager"
import { RealTimeMonitor } from "@/components/admin/real-time-monitor"
import { CalendarManager } from "@/components/admin/calendar-manager"
import { GymManager } from "@/components/admin/gym-manager"
import { WorkScheduleManager } from "@/components/admin/work-schedule-manager"
import { CustomPageManager } from "@/components/admin/custom-page-manager"
import { CustomPageContent } from "@/components/admin/custom-page-content"
import { CashRegisterFieldManager } from "@/components/admin/cash-register-field-manager"
import { CashRecapManager } from "@/components/admin/cash-recap-manager"
import { IncidentsManager } from "@/components/admin/incidents-manager"
import { SettingsManager } from "@/components/admin/settings-manager"
import { VentesStockManager } from "@/components/admin/ventes-stock-manager"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Image from "next/image"
import {
  ClipboardList, Building2, Users, Calendar, CalendarDays,
  Activity, Shield, LogOut, LayoutDashboard, Banknote, BarChart3,
  Menu, X, ChevronRight, UserCheck, PanelLeftClose, PanelLeftOpen, Settings, AlertTriangle, ShoppingBag,
} from "lucide-react"
import * as LucideIcons from "lucide-react"
import { fetchCurrentUser, clearCurrentUser } from "@/lib/current-user"

const CommunicationWidget = dynamic(
  () => import("@/components/communication/communication-widget").then((m) => m.CommunicationWidget),
  { ssr: false }
)

interface CustomPage {
  id: string
  title: string
  icon: string
  description: string | null
  orderIndex: number
  isActive: boolean
  roleIds: any
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("tasks")
  // Marque le moment où l'onglet a été restauré depuis localStorage, pour
  // ne pas écraser la valeur stockée avant la restauration.
  const tabRestored = useRef(false)
  const [userEmail, setUserEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [customPages, setCustomPages] = useState<CustomPage[]>([])
  const [isLoadingPages, setIsLoadingPages] = useState(true)
  // Desktop: sidebar ouverte par défaut, peut être réduite
  const [desktopOpen, setDesktopOpen] = useState(true)
  // Mobile: sidebar overlay
  const [mobileOpen, setMobileOpen] = useState(false)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const router = useRouter()

  // Restaure le dernier onglet consulté au chargement
  useEffect(() => {
    const saved = localStorage.getItem("admin-active-tab")
    if (saved) setActiveTab(saved)
    tabRestored.current = true
  }, [])

  // Sauvegarde l'onglet actif (après la restauration initiale)
  useEffect(() => {
    if (!tabRestored.current) return
    localStorage.setItem("admin-active-tab", activeTab)
  }, [activeTab])

  useEffect(() => {
    const init = async () => {
      const user = await fetchCurrentUser()
      if (!user || !user.role) { router.push("/"); return }
      if (user.role !== "admin" && user.role !== "superadmin") { router.push("/access-denied"); return }
      setUserEmail(user.email)
      setUserName(user.name)
      setUserRole(user.role)
      fetch("/api/cleanup-temp-periods", { method: "POST" }).catch(() => {})
    }
    init()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/active-employees-count")
        if (!res.ok) return
        const data = await res.json()
        setOnlineCount(data.count ?? 0)
      } catch {}
    }
    load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const loadCustomPages = async () => {
      if (userRole === "superadmin") { setIsLoadingPages(false); return }
      try {
        const res = await fetch("/api/custom-pages")
        if (res.ok) setCustomPages((await res.json()).data || [])
      } catch {
      } finally { setIsLoadingPages(false) }
    }
    if (userRole) loadCustomPages()
  }, [userRole])

  useEffect(() => {
    if (!userEmail) return
    const run = () => fetch("/api/reminders/process", { method: "POST" }).catch(() => {})
    run()
    const iv = setInterval(run, 60_000)
    return () => clearInterval(iv)
  }, [userEmail])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    clearCurrentUser()
    localStorage.clear()
    router.push("/")
  }

  const fixedTabs = [
    { id: "tasks",       label: "Tâches",       icon: ClipboardList, component: <TaskManager /> },
    { id: "gyms",        label: "Salles",        icon: Building2,     component: <GymManager /> },
    { id: "employees",   label: "Utilisateurs",  icon: Users,         component: <EmployeeManager /> },
    { id: "schedule",    label: "Planning",       icon: Calendar,      component: <WorkScheduleManager /> },
    { id: "calendar",    label: "Événements",    icon: CalendarDays,  component: <CalendarManager /> },
    { id: "cash-fields", label: "Config Caisse", icon: Banknote,      component: <CashRegisterFieldManager /> },
    { id: "cash-recap",  label: "Tableau de bord",  icon: BarChart3,     component: <CashRecapManager /> },
    { id: "incidents",   label: "Incidents",       icon: AlertTriangle,  component: <IncidentsManager /> },
    { id: "monitor",     label: "Suivi",           icon: Activity,       component: <RealTimeMonitor /> },
    { id: "ventes",      label: "Ventes & Stock",  icon: ShoppingBag,    component: <VentesStockManager /> },
  ]

  const managementTabs = (userRole === "superadmin")
    ? [{ id: "page-management", label: "Gestion Pages", icon: LayoutDashboard, component: <CustomPageManager /> }]
    : []

  const dynamicTabs = customPages.map((page) => {
    const IconComponent = (LucideIcons as any)[page.icon] || LucideIcons.FileText
    return {
      id: `custom-${page.id}`,
      label: page.title,
      icon: IconComponent,
      component: <CustomPageContent pageId={page.id} pageTitle={page.title} pageIcon={page.icon} />,
    }
  })

  // Onglet Paramètres (RGPD, documents légaux) — affiché à part, sous la navigation
  const settingsTab = {
    id: "settings",
    label: "Paramètres",
    icon: Settings,
    component: <SettingsManager userRole={userRole} />,
  }

  const navTabs = [...fixedTabs, ...dynamicTabs, ...managementTabs]
  const allTabs = [...navTabs, settingsTab]
  const activeTabData = allTabs.find((t) => t.id === activeTab)

  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  // Tant que l'identité n'est pas chargée (via /api/me), on n'affiche pas le
  // contenu : cela évite que les composants enfants (dont le widget de
  // messagerie) lisent une identité encore vide au premier rendu.
  if (!userRole) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">

      {/* ── Header global (logo + FitEvo + toggle) ─────────── */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 z-40 flex-shrink-0">
        {/* Hamburger mobile */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden text-gray-500 hover:text-gray-800 p-1 rounded-md"
          aria-label="Ouvrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Toggle sidebar desktop */}
        <button
          onClick={() => setDesktopOpen((v) => !v)}
          className="hidden lg:flex text-gray-400 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          aria-label={desktopOpen ? "Réduire sidebar" : "Ouvrir sidebar"}
        >
          {desktopOpen
            ? <PanelLeftClose className="w-5 h-5" />
            : <PanelLeftOpen  className="w-5 h-5" />
          }
        </button>

        {/* Séparateur */}
        <div className="hidden lg:block w-px h-6 bg-gray-200" />

        {/* Logo + nom */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-red-50">
            <Image
              src="/Logo-removebg-preview.png"
              alt="FitEvo"
              width={32}
              height={32}
              className="object-contain w-full h-full"
            />
          </div>
          <span className="text-base font-extrabold text-gray-900 tracking-tight">FitEvo</span>
        </div>

        {/* Section active (mobile) */}
        <span className="lg:hidden ml-auto text-xs font-medium text-gray-500 truncate max-w-[130px]">
          {activeTabData?.label}
        </span>

        {/* Profil (desktop droite) */}
        <div className="hidden lg:flex items-center gap-2 ml-auto">
          <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-red-600" />
          </div>
          <span className="text-sm font-medium text-gray-700 truncate max-w-[160px]">{userName || "Admin"}</span>
        </div>
      </header>

      {/* ── Corps (sidebar + contenu) ───────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Overlay mobile */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ── Sidebar ──────────────────────────────────────── */}
        <aside
          className={[
            /* Base */
            "bg-white border-r border-gray-200 flex flex-col z-40 flex-shrink-0",
            "transition-all duration-300 ease-in-out overflow-hidden",
            /* Mobile: overlay fixe */
            "fixed top-0 left-0 h-full w-64",
            mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
            /* Desktop: statique, largeur selon état */
            desktopOpen
              ? "lg:static lg:translate-x-0 lg:w-60 lg:shadow-none"
              : "lg:static lg:translate-x-0 lg:w-0 lg:border-r-0",
          ].join(" ")}
        >
          {/* Bouton fermer (mobile) */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 lg:hidden">
            <span className="text-sm font-bold text-gray-600">Menu</span>
            <button
              onClick={() => setMobileOpen(false)}
              className="text-gray-400 hover:text-gray-700 p-1 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profil admin (dans sidebar mobile) */}
          <div className="px-4 py-3 border-b border-gray-100 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{userName || "Admin"}</p>
                <p className="text-xs text-gray-400 truncate">{userEmail}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5 min-w-[236px]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 whitespace-nowrap">
              Gestion
            </p>
            {navTabs.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMobileOpen(false) }}
                  className={[
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                    "transition-all duration-150 group whitespace-nowrap",
                    active
                      ? "bg-red-50 text-red-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  ].join(" ")}
                >
                  <tab.icon className={[
                    "w-4 h-4 flex-shrink-0",
                    active ? "text-red-500" : "text-gray-400 group-hover:text-gray-600",
                  ].join(" ")} />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                </button>
              )
            })}

            {/* Séparateur + bouton Paramètres (sous Suivi) */}
            <div className="pt-2 mt-2 border-t border-gray-100">
              {(() => {
                const active = activeTab === settingsTab.id
                return (
                  <button
                    onClick={() => { setActiveTab(settingsTab.id); setMobileOpen(false) }}
                    className={[
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                      "transition-all duration-150 group whitespace-nowrap",
                      active
                        ? "bg-red-50 text-red-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    ].join(" ")}
                  >
                    <settingsTab.icon className={[
                      "w-4 h-4 flex-shrink-0",
                      active ? "text-red-500" : "text-gray-400 group-hover:text-gray-600",
                    ].join(" ")} />
                    <span className="flex-1 text-left">{settingsTab.label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                  </button>
                )
              })()}
            </div>
          </nav>

          {/* Déconnexion */}
          <div className="px-2.5 py-3 border-t border-gray-100 min-w-[236px]">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all group whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 group-hover:text-red-500" />
              Déconnexion
            </button>
          </div>
        </aside>

        {/* ── Contenu principal ─────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">

          {/* Hero image — carte arrondie détachée */}
          <div className="px-4 pt-5 sm:px-6 sm:pt-6">
            <div className="relative rounded-2xl overflow-hidden h-44 sm:h-52 md:h-60 shadow-lg">
              <Image
                src="/fitevo-salle.jpg"
                alt="Salle FitEvo"
                fill
                className="object-cover"
                priority
              />
              {/* Dégradé couleur → transparence */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

              {/* Contenu de la carte */}
              <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 sm:px-7 sm:pb-6">
                <p className="text-[10px] sm:text-xs font-bold text-white/50 uppercase tracking-widest mb-1">
                  Administration
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-3">
                  Dashboard
                </h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-xs sm:text-sm text-white/75 capitalize">{dateStr}</span>
                  <span className="hidden sm:block text-white/30 text-lg leading-none">•</span>
                  <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
                    <UserCheck className="w-3.5 h-3.5 text-green-300 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-white font-medium whitespace-nowrap">
                      {onlineCount === null ? "…" : onlineCount}{" "}
                      employé{onlineCount !== 1 ? "s" : ""} actif{onlineCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Zone contenu */}
          <div className="px-4 pt-4 pb-6 sm:px-6 sm:pt-5">
            {/* Fil d'ariane */}
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-xs text-gray-400">Administration</span>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <span className="text-xs font-semibold text-gray-700">{activeTabData?.label}</span>
            </div>

            {/* Carte contenu */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 md:p-6">
              {activeTabData?.component}
            </div>
          </div>
        </main>
      </div>

      <CommunicationWidget />
    </div>
  )
}
