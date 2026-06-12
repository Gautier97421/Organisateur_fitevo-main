"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Coffee, Clock, Play, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface BreakManagerProps {
  period: "matin" | "aprem" | "journee"
  isOnBreak: boolean
  breakType: "short" | "lunch" | null
  breakStartTime: Date | null
  accumulatedBreakTime: number // en minutes
  shortBreaksCompleted: number
  shortBreakProgress: number
  lunchBreakTaken: boolean
  onBreakStart: (type: "short" | "lunch") => void
  onBreakEnd: () => void
  onBreakResume: (type: "short") => void
}

export function BreakManager({
  period,
  isOnBreak,
  breakType,
  breakStartTime,
  accumulatedBreakTime,
  shortBreaksCompleted,
  shortBreakProgress,
  lunchBreakTaken,
  onBreakStart,
  onBreakEnd,
  onBreakResume,
}: BreakManagerProps) {
  const [currentBreakDuration, setCurrentBreakDuration] = useState(0)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [showLunchDialog, setShowLunchDialog] = useState(false)
  const [showResumeDialog, setShowResumeDialog] = useState(false)

  const REQUIRED_BREAK_MINUTES = 20
  const MAX_SHORT_BREAKS_JOURNEE = 2

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isOnBreak && breakStartTime) {
      interval = setInterval(() => {
        const now = new Date()
        const duration = Math.floor((now.getTime() - breakStartTime.getTime()) / 1000 / 60)
        setCurrentBreakDuration(duration)
      }, 1000)
    } else {
      setCurrentBreakDuration(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isOnBreak, breakStartTime])

  const isJournee = period === "journee"
  const activeBreakDuration = isOnBreak && breakType === "short" ? currentBreakDuration : 0
  const totalBreakTime = accumulatedBreakTime + currentBreakDuration
  const shortBreakTotal = shortBreakProgress + activeBreakDuration
  const remainingBreakTime = Math.max(0, REQUIRED_BREAK_MINUTES - shortBreakTotal)
  const isCurrentShortBreakComplete = shortBreakTotal >= REQUIRED_BREAK_MINUTES
  const maxShortBreaks = isJournee ? MAX_SHORT_BREAKS_JOURNEE : 1
  const canStartNewShortBreak = shortBreaksCompleted < maxShortBreaks && shortBreakProgress === 0
  const hasShortBreakInProgress = shortBreakProgress > 0 && shortBreaksCompleted < maxShortBreaks
  const currentShortBreakIndex = Math.min(shortBreaksCompleted + 1, maxShortBreaks)

  const handleStartShortBreak = () => {
    setShowStartDialog(false)
    onBreakStart("short")
  }

  const handleStartLunchBreak = () => {
    setShowLunchDialog(false)
    onBreakStart("lunch")
  }

  const handleResumeWork = () => {
    setShowResumeDialog(false)
    onBreakEnd()
  }

  const handleResumeBreak = () => {
    onBreakResume("short")
  }

  // ── En pause (courte ou midi) : bouton compact ────────────────────────────
  if (isOnBreak) {
    return (
      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 flex items-center gap-1.5"
          >
            <Coffee className="h-3.5 w-3.5 animate-pulse" />
            {breakType === "lunch"
              ? `Pause midi — ${currentBreakDuration}min`
              : `En pause — ${currentBreakDuration}min`}
            <Play className="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
              <Coffee className="h-6 w-6" />
              <span>{breakType === "lunch" ? "Terminer la pause midi" : "Reprendre le travail"}</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              {breakType === "lunch" ? (
                <>Vous avez pris {currentBreakDuration} minute(s) de pause midi.</>
              ) : isCurrentShortBreakComplete ? (
                <span className="text-green-600 flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  Votre pause de {REQUIRED_BREAK_MINUTES} minutes est terminée !
                </span>
              ) : (
                <>
                  Vous avez pris {shortBreakTotal} min sur les {REQUIRED_BREAK_MINUTES} requises.{" "}
                  <span className="text-red-600 font-medium">
                    Il vous reste {remainingBreakTime} minutes à prendre plus tard.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto border-gray-300 flex items-center justify-center gap-2">
                <XCircle className="h-4 w-4" />
                {breakType === "lunch" ? "Continuer la pause midi" : "Continuer la pause"}
              </Button>
            </DialogTrigger>
            <Button onClick={handleResumeWork} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2">
              <Play className="h-4 w-4" /> Reprendre le travail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ── Pas en pause ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {hasShortBreakInProgress ? (
        // Pause courte interrompue — reprendre
        <>
          <Button
            onClick={handleResumeBreak}
            size="sm"
            className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
          >
            <Coffee className="h-3.5 w-3.5" />
            Reprendre pause {isJournee ? `${currentShortBreakIndex}/${maxShortBreaks}` : ""}
          </Button>
          <span className="text-xs text-red-600 flex items-center gap-1">
            <Clock className="h-3 w-3" /> {remainingBreakTime}min restantes
          </span>
        </>
      ) : shortBreaksCompleted >= maxShortBreaks && (!isJournee || lunchBreakTaken) ? (
        // Toutes les pauses effectuées
        <Button disabled size="sm" className="h-8 text-xs bg-green-100 text-green-700 border border-green-300 flex items-center gap-1.5 cursor-default">
          <CheckCircle className="h-3.5 w-3.5" /> Pauses effectuées
        </Button>
      ) : (
        // Commencer une pause
        <>
          <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!canStartNewShortBreak}
                className="h-8 text-xs border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-1.5"
              >
                <Coffee className="h-3.5 w-3.5" />
                {isJournee
                  ? shortBreaksCompleted < maxShortBreaks
                    ? `Pause ${shortBreaksCompleted + 1}/${maxShortBreaks}`
                    : "Pauses 20 min ok"
                  : "Prendre une pause"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
                  <Coffee className="h-6 w-6" />
                  <span>Confirmer la pause</span>
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 leading-relaxed">
                  Vous allez commencer votre pause obligatoire de {REQUIRED_BREAK_MINUTES} minutes.{" "}
                  <strong>Vous pourrez reprendre le travail à tout moment et continuer votre pause plus tard.</strong>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto border-gray-300 flex items-center justify-center gap-2">
                    <XCircle className="h-4 w-4" /> Annuler
                  </Button>
                </DialogTrigger>
                <Button onClick={handleStartShortBreak} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2">
                  <Coffee className="h-4 w-4" /> Commencer la pause
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isJournee && (
            <Dialog open={showLunchDialog} onOpenChange={setShowLunchDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={lunchBreakTaken}
                  className="h-8 text-xs border-gray-300 hover:bg-gray-50 bg-white flex items-center gap-1.5"
                >
                  <Coffee className="h-3.5 w-3.5" />
                  {lunchBreakTaken ? "Pause midi prise" : "Pause midi"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
                    <Coffee className="h-6 w-6" />
                    <span>Confirmer la pause midi</span>
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 leading-relaxed">
                    Cette pause midi est libre, mais elle ne peut être prise qu'une seule fois pendant la journée.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto border-gray-300 flex items-center justify-center gap-2">
                      <XCircle className="h-4 w-4" /> Annuler
                    </Button>
                  </DialogTrigger>
                  <Button onClick={handleStartLunchBreak} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2">
                    <Coffee className="h-4 w-4" /> Commencer la pause midi
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <span className="text-xs text-gray-400 flex items-center gap-1 hidden sm:flex">
            <AlertTriangle className="h-3 w-3" />
            {isJournee
              ? `${maxShortBreaks}×${REQUIRED_BREAK_MINUTES}min + midi`
              : `${REQUIRED_BREAK_MINUTES}min obligatoire`}
          </span>
        </>
      )}
    </div>
  )
}
