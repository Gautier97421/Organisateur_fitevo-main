"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Power } from "lucide-react"
import { toast } from "sonner"
import {
  endWorkPeriod,
  fetchLatestPendantEntry,
  persistFinPeriodeEntry,
  type Period,
} from "@/lib/end-of-period"
import { getUserId } from "@/lib/current-user"

interface EndPeriodDialogProps {
  isOpen: boolean
  onClose: () => void
  period: Period
  subPeriod?: "debut" | "milieu" | "fin" | null
  gymId?: string | null
  roleId?: string | null
  onConfirmed: () => void
}

interface CheckState {
  loading: boolean
  requiredTasksOk: boolean
  requiredMissingCount: number
  cashOk: boolean
  latestCash: any | null
  totalTasks: number
  completedTasks: number
}

const initialState: CheckState = {
  loading: true,
  requiredTasksOk: false,
  requiredMissingCount: 0,
  cashOk: false,
  latestCash: null,
  totalTasks: 0,
  completedTasks: 0,
}

export function EndPeriodDialog({
  isOpen,
  onClose,
  period,
  subPeriod,
  gymId,
  roleId,
  onConfirmed,
}: EndPeriodDialogProps) {
  const [state, setState] = useState<CheckState>(initialState)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    const runChecks = async () => {
      setState({ ...initialState, loading: true })

      try {
        // 1. Fetch template tasks for period
        let templatesUrl = `/api/db/tasks?period=${period}`
        if (gymId) templatesUrl += `&gym_id=${gymId}`
        const tmplRes = await fetch(templatesUrl)
        let templates: any[] = []
        if (tmplRes.ok) {
          const json = await tmplRes.json()
          templates = Array.isArray(json.data) ? json.data : json.data ? [json.data] : []
          templates = templates.filter((t: any) => !t.status || t.status === "pending")
          if (roleId) {
            templates = templates.filter((t: any) => {
              if (!t.role_ids || (Array.isArray(t.role_ids) && t.role_ids.length === 0)) return true
              const ids = Array.isArray(t.role_ids)
                ? t.role_ids
                : typeof t.role_ids === "string"
                ? JSON.parse(t.role_ids)
                : []
              return ids.includes(roleId)
            })
          }
          if ((period === "matin" || period === "aprem") && subPeriod) {
            templates = templates.filter((t: any) => !t.sub_period || t.sub_period === subPeriod)
          }
        }

        // 2. Fetch user's completed tasks today for period
        const userId = getUserId() || ""
        const dayStart = new Date()
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date()
        dayEnd.setHours(23, 59, 59, 999)
        const userTasksUrl = `/api/db/tasks?user_id=${userId}&period=${period}&status=completed&updated_at_gte=${encodeURIComponent(
          dayStart.toISOString()
        )}&updated_at_lte=${encodeURIComponent(dayEnd.toISOString())}`
        const userRes = await fetch(userTasksUrl)
        let userTasks: any[] = []
        if (userRes.ok) {
          const json = await userRes.json()
          userTasks = Array.isArray(json.data) ? json.data : json.data ? [json.data] : []
        }

        const isCompleted = (template: any) =>
          userTasks.some((ut: any) => {
            try {
              const opts =
                typeof ut.options === "string" ? JSON.parse(ut.options) : ut.options || {}
              if (opts?.templateTaskId) return opts.templateTaskId === template.id
            } catch {
              /* ignore */
            }
            return ut.title === template.title
          })

        const requiredTemplates = templates.filter((t: any) => t.required)
        const missingRequired = requiredTemplates.filter((t: any) => !isCompleted(t))
        const completedCount = templates.filter((t: any) => isCompleted(t)).length

        // 3. Latest [PENDANT] cash entry today
        const latest = await fetchLatestPendantEntry({ period, gymId: gymId || null })

        if (cancelled) return
        setState({
          loading: false,
          requiredTasksOk: missingRequired.length === 0,
          requiredMissingCount: missingRequired.length,
          cashOk: !!latest,
          latestCash: latest,
          totalTasks: templates.length,
          completedTasks: completedCount,
        })
      } catch {
        if (!cancelled) {
          setState({ ...initialState, loading: false })
        }
      }
    }

    runChecks()
    return () => {
      cancelled = true
    }
  }, [isOpen, period, subPeriod, gymId, roleId])

  const canConfirm = !state.loading && state.requiredTasksOk && state.cashOk && !submitting

  const handleConfirm = async () => {
    if (!canConfirm || !state.latestCash) return

    setSubmitting(true)
    try {
      const persisted = await persistFinPeriodeEntry({
        period,
        gymId: gymId || null,
        source: state.latestCash,
      })
      if (!persisted) {
        toast.error("Impossible d'enregistrer la fin de caisse.")
        setSubmitting(false)
        return
      }

      await endWorkPeriod({
        period,
        gymId: gymId || null,
        cashTotal: Number(state.latestCash.total_register || 0),
        tasksCompleted: state.completedTasks,
        totalTasks: state.totalTasks,
      })

      toast.success("Période de travail terminée.")
      onConfirmed()
      onClose()
    } catch {
      toast.error("Erreur lors de la clôture de la période.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2 text-gray-900">
            <Power className="h-6 w-6 text-red-600" />
            Fin de période de travail
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Vérifiez les conditions avant de clôturer votre période.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {state.loading ? (
            <div className="flex items-center justify-center py-6 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Vérification en cours…
            </div>
          ) : (
            <>
              <div
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  state.requiredTasksOk
                    ? "border-green-300 bg-green-50"
                    : "border-red-300 bg-red-50"
                }`}
              >
                {state.requiredTasksOk ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="text-sm">
                  <div
                    className={`font-medium ${
                      state.requiredTasksOk ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    Tâches obligatoires
                  </div>
                  <div className={state.requiredTasksOk ? "text-green-700" : "text-red-700"}>
                    {state.requiredTasksOk
                      ? "Toutes les tâches obligatoires sont validées."
                      : `${state.requiredMissingCount} tâche(s) obligatoire(s) non validée(s).`}
                  </div>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  state.cashOk ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
                }`}
              >
                {state.cashOk ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="text-sm">
                  <div
                    className={`font-medium ${state.cashOk ? "text-green-800" : "text-red-800"}`}
                  >
                    Comptage de caisse
                  </div>
                  <div className={state.cashOk ? "text-green-700" : "text-red-700"}>
                    {state.cashOk
                      ? `Dernier comptage enregistré : ${Number(
                          state.latestCash?.total_register || 0
                        ).toFixed(2)} €.`
                      : "Aucun comptage de caisse enregistré. Effectuez un comptage depuis la rubrique Caisse."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  Une fois validée, votre période de travail sera <strong>terminée</strong>. Vous
                  serez ramené(e) au menu principal et un email récapitulatif sera envoyé.
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validation…
              </>
            ) : (
              "Valider la fin de période"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
