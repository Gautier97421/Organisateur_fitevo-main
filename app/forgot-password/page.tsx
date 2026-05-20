"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'envoi")
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
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="mx-auto w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 shadow-lg">
            <img
              src="/Logo-removebg-preview.png"
              alt="FitEvo"
              className="w-14 h-14 md:w-16 md:h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Mot de passe oublié
          </h1>
          <p className="text-gray-300 text-base">
            Entrez votre adresse email pour recevoir un lien de réinitialisation
          </p>
        </div>

        <Card className="shadow-lg border border-gray-200 bg-white dark:bg-gray-800">
          <CardContent className="p-8">
            {success ? (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                    Email envoyé !
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Si cet email est enregistré, vous recevrez un lien de réinitialisation valable{" "}
                    <strong>1 heure</strong>.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push("/")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour à la connexion
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Votre adresse email"
                    className="h-12 text-base border border-gray-300 focus:border-red-600 focus:ring-1 focus:ring-red-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 shadow transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Envoi en cours...</span>
                    </div>
                  ) : (
                    "Envoyer le lien"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la connexion
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
