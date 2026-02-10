"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, UserPlus } from "lucide-react"

function FirstLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const emailParam = searchParams.get("email")
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validations
    if (!username || username.length < 3) {
      setError("Le pseudo doit contenir au moins 3 caractères")
      return
    }

    if (!password || password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      return
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    setIsLoading(true)

    try {
      // Vérifier que l'utilisateur existe et que c'est bien sa première connexion
      const checkResponse = await fetch(`/api/db/users?email=${encodeURIComponent(email)}&single=true`)
      if (!checkResponse.ok) {
        throw new Error("Utilisateur non trouvé")
      }

      const checkData = await checkResponse.json()
      const user = checkData.data

      if (!user) {
        throw new Error("Utilisateur non trouvé")
      }

      if (!user.is_first_login) {
        throw new Error("Ce compte a déjà été configuré")
      }

      // Vérifier que le pseudo n'est pas déjà pris
      const usernameCheckResponse = await fetch(`/api/db/users?username=${encodeURIComponent(username)}&single=true`)
      if (usernameCheckResponse.ok) {
        const usernameData = await usernameCheckResponse.json()
        if (usernameData.data && usernameData.data.id !== user.id) {
          throw new Error("Ce pseudo est déjà utilisé")
        }
      }

      // Mettre à jour l'utilisateur avec le pseudo et le mot de passe
      const updateResponse = await fetch(`/api/db/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
          is_first_login: false,
        }),
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json()
        throw new Error(errorData.error || "Erreur lors de la configuration du compte")
      }

      alert("✅ Compte configuré avec succès ! Vous pouvez maintenant vous connecter.")
      router.push("/")
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-black to-red-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl dark:bg-gray-800">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
              <UserPlus className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold dark:text-white">Première connexion</CardTitle>
          <CardDescription className="dark:text-gray-300">
            Configurez votre pseudo et votre mot de passe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-gray-200">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="dark:text-gray-200">
                Pseudo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choisissez un pseudo"
                required
                minLength={3}
                className="dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Minimum 3 caractères. Vous pourrez vous connecter avec ce pseudo ou votre email.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="dark:text-gray-200">
                Mot de passe <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choisissez un mot de passe"
                  required
                  minLength={6}
                  className="pr-10 dark:bg-gray-700 dark:text-white [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Minimum 6 caractères</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="dark:text-gray-200">
                Confirmer le mot de passe <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmez votre mot de passe"
                  required
                  minLength={6}
                  className="pr-10 dark:bg-gray-700 dark:text-white [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              disabled={isLoading}
            >
              {isLoading ? "Configuration..." : "Configurer mon compte"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function FirstLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-red-600 via-black to-red-800 flex items-center justify-center"><div className="text-white">Chargement...</div></div>}>
      <FirstLoginForm />
    </Suspense>
  )
}
