import { getUserId, getUserEmail, getUserName } from "@/lib/current-user"

export type Period = "matin" | "aprem" | "journee"
export type SubPeriod = "debut" | "milieu" | "fin" | null | undefined

/**
 * Le comptage de caisse de fermeture n'incombe qu'aux employés qui tiennent le créneau de
 * fermeture : le sous-créneau « Fin », ou la journée entière (qui va de l'ouverture à la
 * fermeture). Pour les autres, ce sont les ventes qui tracent les mouvements d'argent entre
 * l'ouverture et la fermeture — comme pour le comptage d'ouverture, fait une seule fois par jour.
 */
export function requiresClosingCashCount(period: Period, subPeriod: SubPeriod): boolean {
  if (period === "journee") return true
  return subPeriod === "fin"
}

/**
 * Persist the [FIN_PERIODE] cash entry from the closing count filled in by the employee.
 *
 * Le comptage de caisse se fait à l'ouverture et à la fermeture uniquement : entre les deux, ce
 * sont les ventes qui tracent les mouvements d'argent. Cette fonction enregistre le comptage de
 * fermeture, qui sert de référence au récap admin.
 */
export async function persistFinPeriodeEntry(params: {
  period: Period
  gymId?: string | null
  cashData: any
}): Promise<boolean> {
  const userId = getUserId()
  const userEmail = getUserEmail()
  const userName = getUserName()
  if (!userId || !userEmail) return false

  const cashData = params.cashData || {}
  const mergedNotes = ["[FIN_PERIODE]", cashData.notes || ""].filter(Boolean).join(" ").trim()

  // Les champs personnalisés de la fiche de caisse arrivent à plat dans cashData : tout ce qui
  // n'est pas un champ standard est un champ personnalisé et doit être conservé tel quel.
  const customValues: Record<string, any> = {
    ...Object.fromEntries(
      Object.entries(cashData).filter(([key]) =>
        !["cash_amount", "total_register", "coins_detail", "notes", "_coinCounts"].includes(key)
      )
    ),
    // Clé canonique du détail des pièces, celle que relisent les écrans de récap.
    ...(cashData._coinCounts ? { __coinCounts: cashData._coinCounts } : {}),
  }

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
      totalRegister: Number(cashData.total_register || 0),
      cashAmount: Number(cashData.cash_amount || 0),
      coinsDetail: cashData.coins_detail || "",
      notes: mergedNotes,
      customValues,
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
  // null quand le créneau n'impose pas de comptage de fermeture : le récap n'affiche alors
  // aucun montant plutôt qu'un trompeur 0,00 EUR.
  cashTotal?: number | null
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
        const hasCashCount = params.cashTotal !== null && params.cashTotal !== undefined
        const cashMarker = hasCashCount ? ` | [CASH_REGISTER_DONE:${gymKey}:${today}]` : ""
        const cashSummary = hasCashCount ? ` | Caisse: ${Number(params.cashTotal).toFixed(2)} EUR` : ""
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
              cashTotal: hasCashCount ? Number(params.cashTotal) : undefined,
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
