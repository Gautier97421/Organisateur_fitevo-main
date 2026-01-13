"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  isOnBreak: boolean
  breakStartTime: Date | null
  accumulatedBreakTime: number // en minutes
  onBreakStart: () => void
  onBreakEnd: () => void
  onBreakResume: () => void
}

export function BreakManager({
  isOnBreak,
  breakStartTime,
  accumulatedBreakTime,
  onBreakStart,
  onBreakEnd,
  onBreakResume,
}: BreakManagerProps) {
  const [currentBreakDuration, setCurrentBreakDuration] = useState(0)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [showResumeDialog, setShowResumeDialog] = useState(false)

  const REQUIRED_BREAK_MINUTES = 15

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

  const totalBreakTime = accumulatedBreakTime + currentBreakDuration
  const remainingBreakTime = Math.max(0, REQUIRED_BREAK_MINUTES - totalBreakTime)
  const isBreakComplete = totalBreakTime >= REQUIRED_BREAK_MINUTES

  const handleStartBreak = () => {
    setShowStartDialog(false)
    onBreakStart()
  }

  const handleResumeWork = () => {
    setShowResumeDialog(false)
    onBreakEnd()
  }

  const handleResumeBreak = () => {
    onBreakResume()
  }

  if (isOnBreak) {
    return (
      <Card className="border-2 border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600">
        <CardContent className="p-4">
          <div className="text-center">
            <div className="text-3xl mb-2">☕</div>
            <p className="font-bold text-orange-800 dark:text-orange-300 text-lg">Pause en cours</p>
            <p className="text-orange-700 dark:text-orange-400">Session actuelle : {currentBreakDuration} min</p>
            <p className="text-orange-700 dark:text-orange-400">
              Total : {totalBreakTime} / {REQUIRED_BREAK_MINUTES} minutes
            </p>
            <div className="mt-3 space-y-2">
              <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">⏸️ Reprendre le travail</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800">
                  <DialogHeader>
                    <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                      <span className="text-2xl">⏸️</span>
                      <span>Reprendre le travail</span>
                    </DialogTitle>
                    <DialogDescription className="text-lg text-gray-600 dark:text-gray-300">
                      {isBreakComplete ? (
                        <span className="text-green-600 dark:text-green-400">
                          ✅ Votre pause de {REQUIRED_BREAK_MINUTES} minutes est terminée !
                        </span>
                      ) : (
                        <>
                          Vous avez pris {totalBreakTime} minutes de pause sur les {REQUIRED_BREAK_MINUTES} requises.
                          <br />
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Il vous reste {remainingBreakTime} minutes à prendre plus tard.
                          </span>
                        </>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="flex space-x-3">
                    <DialogTrigger asChild>
                      <Button variant="outline" className="text-lg px-6 bg-transparent">
                        ❌ Continuer la pause
                      </Button>
                    </DialogTrigger>
                    <Button onClick={handleResumeWork} className="bg-blue-600 hover:bg-blue-700 text-lg px-6">
                      ▶️ Reprendre le travail
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
    <div className="text-center">
      {accumulatedBreakTime > 0 && !isBreakComplete ? (
        // Reprendre une pause en cours
        <div className="space-y-2">
          <Button onClick={handleResumeBreak} className="text-lg px-6 py-3 h-auto bg-orange-600 hover:bg-orange-700">
            ☕ Reprendre la pause
          </Button>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⏰ {remainingBreakTime} min restantes ({accumulatedBreakTime} min déjà prises)
          </p>
        </div>
      ) : isBreakComplete ? (
        // Pause terminée
        <div className="space-y-2">
          <Button disabled className="text-lg px-6 py-3 h-auto bg-green-600">
            ✅ Pause effectuée
          </Button>
          <p className="text-xs text-green-600 dark:text-green-400">Pause de {REQUIRED_BREAK_MINUTES} min terminée</p>
        </div>
      ) : (
        // Commencer une nouvelle pause
        <div className="space-y-2">
          <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-lg px-6 py-3 h-auto bg-transparent">
                ☕ Prendre une pause
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                  <span className="text-2xl">☕</span>
                  <span>Confirmer la pause</span>
                </DialogTitle>
                <DialogDescription className="text-lg text-gray-600 dark:text-gray-300">
                  Vous allez commencer votre pause obligatoire de {REQUIRED_BREAK_MINUTES} minutes.
                  <br />
                  <strong>Vous pourrez reprendre le travail à tout moment et continuer votre pause plus tard.</strong>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex space-x-3">
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-lg px-6 bg-transparent">
                    ❌ Annuler
                  </Button>
                </DialogTrigger>
                <Button onClick={handleStartBreak} className="bg-orange-600 hover:bg-orange-700 text-lg px-6">
                  ☕ Commencer la pause
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            ⚠️ Pause de {REQUIRED_BREAK_MINUTES} min obligatoire
          </p>
        </div>
      )}
    </div>
  )
}
  