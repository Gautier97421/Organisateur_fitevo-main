"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

  if (isOnBreak) {
    if (breakType === "lunch") {
      return (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="text-center">
              <Coffee className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="font-bold text-red-800 text-lg">Pause midi en cours</p>
              <p className="text-red-700">Session actuelle : {currentBreakDuration} min</p>
              <p className="text-red-700">Cette pause est libre (sans limite de temps)</p>
              <div className="mt-3">
                <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
                      <Play className="h-4 w-4" /> Reprendre le travail
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                      <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
                        <span><Coffee className="h-6 w-6" /></span>
                        <span>Terminer la pause midi</span>
                      </DialogTitle>
                      <DialogDescription className="text-sm md:text-base text-gray-600 leading-relaxed">
                        Vous avez pris {currentBreakDuration} minute(s) de pause midi.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto text-sm md:text-lg px-4 md:px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center justify-center gap-2">
                          <XCircle className="h-5 w-5" /> Continuer la pause midi
                        </Button>
                      </DialogTrigger>
                      <Button onClick={handleResumeWork} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-sm md:text-lg px-4 md:px-6 flex items-center justify-center gap-2">
                        <Play className="h-5 w-5" /> Reprendre le travail
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card className="border-2 border-red-300 bg-red-50">
        <CardContent className="p-4">
          <div className="text-center">
            <Coffee className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <p className="font-bold text-red-800 text-lg">
              Pause {isJournee ? `${currentShortBreakIndex}/${maxShortBreaks}` : "en cours"}
            </p>
            <p className="text-red-700">Session actuelle : {currentBreakDuration} min</p>
            <p className="text-red-700">
              Pause actuelle : {shortBreakTotal} / {REQUIRED_BREAK_MINUTES} minutes
            </p>
            <div className="mt-3 space-y-2">
              <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
                    <Play className="h-4 w-4" /> Reprendre le travail
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
                      <span><Coffee className="h-6 w-6" /></span>
                      <span>Reprendre le travail</span>
                    </DialogTitle>
                    <DialogDescription className="text-sm md:text-base text-gray-600 leading-relaxed">
                      {isCurrentShortBreakComplete ? (
                        <span className="text-green-600 flex items-start gap-2">
                          <CheckCircle className="h-5 w-5" /> Votre pause de {REQUIRED_BREAK_MINUTES} minutes est terminée !
                        </span>
                      ) : (
                        <>
                          Vous avez pris {shortBreakTotal} minutes sur les {REQUIRED_BREAK_MINUTES} requises pour cette pause.
                          <br />
                          <span className="text-red-600 font-medium">
                            Il vous reste {remainingBreakTime} minutes à prendre plus tard.
                          </span>
                        </>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto text-sm md:text-lg px-4 md:px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center justify-center gap-2">
                        <XCircle className="h-5 w-5" /> Continuer la pause
                      </Button>
                    </DialogTrigger>
                    <Button onClick={handleResumeWork} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-sm md:text-lg px-4 md:px-6 flex items-center justify-center gap-2">
                      <Play className="h-5 w-5" /> Reprendre le travail
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full">
      {hasShortBreakInProgress ? (
        // Reprendre une pause en cours
        <div className="space-y-2 w-full">
          <Button onClick={handleResumeBreak} size="sm" className="bg-red-600 hover:bg-red-700 text-white shadow-lg text-sm md:text-base w-full sm:w-auto flex items-center justify-center gap-2">
            <Coffee className="h-4 w-4" /> Reprendre la pause {isJournee ? `${currentShortBreakIndex}/${maxShortBreaks}` : ""}
          </Button>
          <p className="text-xs text-red-600 text-center flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> {remainingBreakTime} min restantes ({shortBreakProgress} prises)
          </p>
          {isJournee && !lunchBreakTaken && (
            <Button onClick={handleStartLunchBreak} variant="outline" size="sm" className="border-2 border-red-300 hover:bg-red-50 bg-white text-sm md:text-base w-full sm:w-auto flex items-center justify-center gap-2">
              <Coffee className="h-4 w-4" /> Démarrer la pause midi
            </Button>
          )}
        </div>
      ) : shortBreaksCompleted >= maxShortBreaks && (!isJournee || lunchBreakTaken) ? (
        // Pause terminée
        <div className="space-y-2 w-full">
          <Button disabled size="sm" className="bg-green-600 text-white shadow-lg text-sm md:text-base w-full sm:w-auto flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5" /> Toutes les pauses sont effectuées
          </Button>
          <p className="text-xs text-green-600 dark:text-green-400 text-center">
            {isJournee
              ? `${maxShortBreaks} pauses de ${REQUIRED_BREAK_MINUTES} min + pause midi terminées`
              : `Pause de ${REQUIRED_BREAK_MINUTES} min terminée`}
          </p>
        </div>
      ) : (
        // Commencer une nouvelle pause
        <div className="space-y-2 w-full">
          <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!canStartNewShortBreak}
                className="border-2 border-gray-300 hover:bg-gray-50 bg-white text-sm md:text-base w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <Coffee className="h-4 w-4" />
                {isJournee
                  ? shortBreaksCompleted < maxShortBreaks
                    ? `Prendre pause ${shortBreaksCompleted + 1}/${maxShortBreaks}`
                    : "Pauses 20 min terminées"
                  : "Prendre une pause"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
                  <span><Coffee className="h-6 w-6" /></span>
                  <span>Confirmer la pause</span>
                </DialogTitle>
                <DialogDescription className="text-sm md:text-base text-gray-600 leading-relaxed">
                  Vous allez commencer votre pause obligatoire de {REQUIRED_BREAK_MINUTES} minutes.
                  <br />
                  <strong>Vous pourrez reprendre le travail à tout moment et continuer votre pause plus tard.</strong>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto text-sm md:text-lg px-4 md:px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center justify-center gap-2">
                    <XCircle className="h-5 w-5" /> Annuler
                  </Button>
                </DialogTrigger>
                <Button onClick={handleStartShortBreak} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-sm md:text-lg px-4 md:px-6 flex items-center justify-center gap-2">
                  <Coffee className="h-5 w-5" /> Commencer la pause
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
                  className="border-2 border-gray-300 hover:bg-gray-50 bg-white text-sm md:text-base w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <Coffee className="h-4 w-4" /> {lunchBreakTaken ? "Pause midi déjà prise" : "Prendre la pause midi"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900">
                    <span><Coffee className="h-6 w-6" /></span>
                    <span>Confirmer la pause midi</span>
                  </DialogTitle>
                  <DialogDescription className="text-sm md:text-base text-gray-600 leading-relaxed">
                    Cette pause midi est libre (pas de limite de temps), mais elle ne peut être prise qu'une seule fois pendant la journée.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto text-sm md:text-lg px-4 md:px-6 border border-gray-300 hover:bg-gray-50 bg-white flex items-center justify-center gap-2">
                      <XCircle className="h-5 w-5" /> Annuler
                    </Button>
                  </DialogTrigger>
                  <Button onClick={handleStartLunchBreak} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-sm md:text-lg px-4 md:px-6 flex items-center justify-center gap-2">
                    <Coffee className="h-5 w-5" /> Commencer la pause midi
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <p className="text-xs text-red-600 mt-1 flex items-center justify-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {isJournee
              ? `${maxShortBreaks} pauses de ${REQUIRED_BREAK_MINUTES} min + 1 pause midi (sans limite)`
              : `Pause de ${REQUIRED_BREAK_MINUTES} min obligatoire`}
          </p>
        </div>
      )}
    </div>
  )
}
  