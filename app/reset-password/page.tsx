"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Eye, EyeOff, CheckCircle } from "lucide-react"

function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  useEffect(() => {
    if (!token) {
      setError("Lien invalide. Veuillez refaire une demande de réinitialisation.")
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères")
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erreur lors de la réinitialisation")
        return
      }

      setSuccess(true)
    } catch {
      setError("Erreur de connexion au serveur")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="shadow-lg border border-gray-200 bg-white dark:bg-gray-800">
      <CardContent className="p-8">
        {success ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                Mot de passe mis à jour !
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </p>
            </div>
            <Button
              type="button"
              className="w-full h-12 bg-red-600 hover:bg-red-700"
              onClick={() => router.push("/")}
            >
              Se connecter
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nouveau mot de passe */}
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                className="h-12 text-base border border-gray-300 focus:border-red-600 focus:ring-1 focus:ring-red-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-12"
                required
                minLength={8}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {/* Confirmation */}
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmer le mot de passe"
                className="h-12 text-base border border-gray-300 focus:border-red-600 focus:ring-1 focus:ring-red-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Minimum 8 caractères
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 shadow transition-all duration-200"
              disabled={isLoading || !token}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mise à jour...</span>
                </div>
              ) : (
                "Enregistrer le nouveau mot de passe"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center p-3 md:p-4">
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <div
          className="absolute inset-[-50%] -rotate-45 bg-repeat"
          style={{
            backgroundImage: "url('/logo_fitevo-remove.png')",
            backgroundSize: "180px 180px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
          <div className="mx-auto w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 shadow-lg">
            <img
              src="/Logo-removebg-preview.png"
              alt="FitEvo"
              className="w-14 h-14 md:w-16 md:h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Nouveau mot de passe
          </h1>
          <p className="text-gray-300 text-base">
            Choisissez un nouveau mot de passe sécurisé
          </p>
        </div>

        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
