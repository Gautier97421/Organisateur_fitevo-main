"use client"

import { useState } from "react"
import { Activity, ClipboardList } from "lucide-react"
import { RealTimeMonitor } from "./real-time-monitor"
import { AttendanceTracker } from "./attendance-tracker"

type Tab = "live" | "pointages"

/** Onglet « Suivi » : l'activité en direct, et l'historique des pointages exportable en PDF. */
export function MonitorSection() {
  const [tab, setTab] = useState<Tab>("live")

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "live", label: "Temps réel", icon: <Activity className="w-4 h-4" /> },
    { id: "pointages", label: "Pointages", icon: <ClipboardList className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex-shrink-0",
              t.id === tab ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "live" ? <RealTimeMonitor /> : <AttendanceTracker />}
    </div>
  )
}
