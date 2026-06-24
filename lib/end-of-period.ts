import { getUserId, getUserEmail, getUserName } from "@/lib/current-user"

export type Period = "matin" | "aprem" | "journee"

interface LatestCashEntry {
  total_register?: number
  cash_amount?: number
  coins_detail?: string
  notes?: string
  custom_values?: any
}

/**
 * Fetch latest [PENDANT] cash entry for today/period/user, used to mark end-of-period.
 * Returns null if no entry exists.
 */
export async function fetchLatestPendantEntry(params: {
  period: Period
  gymId?: string | null
}): Promise<LatestCashEntry | null> {
  const userEmail = getUserEmail()
  if (!userEmail) return null

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const todayStr = now.toISOString().split("T")[0]
  const qs = new URLSearchParams({ month })
  if (params.gymId) qs.set("gym_id", params.gymId)

  try {
    const response = await fetch(`/api/db/cash-register-entries?${qs.toString()}`, {
      credentials: "same-origin",
    })
    if (!response.ok) return null
    const data = await response.json()
    const entries = Array.isArray(data.data) ? data.data : []

    const pendantEntries = entries.filter((e: any) => {
      if (e.user_email !== userEmail) return false
      if (e.period !== params.period) return false
      if (!(e.entry_date || "").startsWith(todayStr)) return false
      const notes = e.notes || ""
      return notes.includes("[PENDANT]")
    })

    if (pendantEntries.length === 0) return null

    pendantEntries.sort((a: any, b: any) => {
      const ta = new Date(a.entry_date || a.created_at || 0).getTime()
      const tb = new Date(b.entry_date || b.created_at || 0).getTime()
      return tb - ta
    })

    return pendantEntries[0]
  } catch {
    return null
  }
}

/**
 * Persist a [FIN_PERIODE] cash entry derived from the latest [PENDANT] entry of the day.
 * Used to flag the official period-end count for admin recap.
 */
export async function persistFinPeriodeEntry(params: {
  period: Period
  gymId?: string | null
  source: LatestCashEntry
}): Promise<boolean> {
  const userId = getUserId()
  const userEmail = getUserEmail()
  const userName = getUserName()
  if (!userId || !userEmail) return false

  const sourceNotes = (params.source.notes || "").replace(/\[PENDANT\]/g, "").trim()
  const mergedNotes = ["[FIN_PERIODE]", sourceNotes].filter(Boolean).join(" ").trim()

  const response = await fetch("/api/db/cash-register-entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
      "x-user-email": userEmail,
    },
    body: JSON.stringify({
      entryDate: new Date().toISOString(),
      period: params.period,
      gymId: params.gymId || null,
      userEmail,
      userName,
      totalRegister: Number(params.source.total_register || 0),
      cashAmount: Number(params.source.cash_amount || 0),
      coinsDetail: params.source.coins_detail || "",
      notes: mergedNotes,
      customValues: params.source.custom_values || {},
    }),
  })

  return response.ok
}

/**
 * Closes the active work_schedule for today, writes the cash recap to its notes,
 * sends the admin recap email, and clears period-related localStorage entries.
 */
export async function endWorkPeriod(params: {
  period: Period
  gymId?: string | null
  cashTotal: number
  tasksCompleted: number
  totalTasks: number
}): Promise<void> {
  const userId = getUserId()
  const userEmail = getUserEmail()
  const userName = getUserName()
  if (!userId) return

  const today = new Date().toISOString().split("T")[0]
  const gymKey = params.gymId || "global"

  let totalBreakTime = 0
  try {
    const breakState = localStorage.getItem("employeeBreakState")
    if (breakState) {
      const parsed = JSON.parse(breakState)
      totalBreakTime = parsed.accumulatedBreakTime || 0
      if (parsed.isOnBreak && parsed.breakStartTime) {
        const now = new Date()
        const breakStart = new Date(parsed.breakStartTime)
        totalBreakTime += Math.floor((now.getTime() - breakStart.getTime()) / 1000 / 60)
      }
    }
  } catch { /* ignore */ }

  try {
    const scheduleResponse = await fetch(
      `/api/db/work_schedules?user_id=${userId}&work_date=${today}&type=work`
    )
    if (scheduleResponse.ok) {
      const scheduleData = await scheduleResponse.json()
      const schedules = Array.isArray(scheduleData.data)
        ? scheduleData.data
        : scheduleData.data
        ? [scheduleData.data]
        : []

      const activeSchedule = schedules.find(
        (s: any) => s.notes?.includes("Période:") && !s.end_time
      )

      if (activeSchedule) {
        const endTime = new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
        const cashMarker = ` | [CASH_REGISTER_DONE:${gymKey}:${today}]`
        const cashSummary = ` | Caisse: ${params.cashTotal.toFixed(2)} EUR`
        const updatedNotes = `${activeSchedule.notes || ""} | Pause: ${totalBreakTime} min${cashMarker}${cashSummary}`

        await fetch(`/api/db/work_schedules/${activeSchedule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            end_time: endTime,
            notes: updatedNotes,
          }),
        })

        fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId,
            "x-user-email": userEmail,
          },
          body: JSON.stringify({
            type: "work-recap",
            data: {
              employeeName: userName,
              employeeEmail: userEmail,
              gymId: params.gymId || null,
              period: params.period,
              startTime: activeSchedule.start_time || "",
              endTime,
              breakDuration: totalBreakTime,
              tasksCompleted: params.tasksCompleted,
              totalTasks: params.totalTasks,
              cashTotal: params.cashTotal,
            },
          }),
        }).catch(() => { /* non-blocking */ })
      }
    }
  } catch { /* ignore */ }

  try {
    localStorage.removeItem(`employee_${userId}_period`)
    localStorage.removeItem(`employee_${userId}_sessionDate`)
    localStorage.removeItem(`employee_${userId}_subPeriod`)
  } catch { /* ignore */ }
}
