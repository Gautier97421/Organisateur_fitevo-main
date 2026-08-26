"use client"

import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCcw } from "lucide-react"
import logger from "@/lib/logger"

/**
 * Écran d'erreur des pages de l'application.
 *
 * Sans ce fichier, une exception non rattrapée affiche la page d'erreur brute de
 * Next — et en développement, la trace complète. Le détail technique reste dans
 * les logs ; l'utilisateur ne voit qu'un message compréhensible et un bouton pour
 * réessayer sans perdre sa session.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error("Erreur d'affichage", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle>Une erreur est survenue</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            L'affichage de cette page a échoué. Vous pouvez réessayer ; si le problème
            persiste, contactez un administrateur.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400">Référence : {error.digest}</p>
          )}
          <Button variant="outline" className="w-full bg-transparent" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
