"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Check, X, Key } from "lucide-react"

export function CreatePasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  const validation = {
    minLength: password.length >= 6,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
    isValid: password.length >= 6 && /[a-zA-Z]/.test(password) && /\d/.test(password),
    strength: password.length < 6 ? "weak" : /[a-zA-Z]/.test(password) && /\d/.test(password) ? "strong" : "medium"
  }
  const passwordsMatch = password === confirmPassword && password.length > 0

  useEffect(() => {
    const emailParam = searchParams.get("email")
    if (!emailParam) {
      router.push("/")
      return
    }
    setEmail(emailParam)
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validation.isValid || !passwordsMatch) {
      setError("Veuillez corriger les erreurs avant de continuer")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Mettre à jour le mot de passe via l'API
      const response = await fetch('/api/db/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erreur lors de la création du mot de passe")
      }

      // Maintenant se connecter automatiquement
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const loginData = await loginResponse.json()

      if (!loginResponse.ok) {
        throw new Error(loginData.error || "Erreur de connexion")
      }

      // Stocker les informations de l'utilisateur
      localStorage.setItem("userId", loginData.user.id)
      localStorage.setItem("userEmail", loginData.user.email)
      localStorage.setItem("userName", loginData.user.name)
      localStorage.setItem("userRole", loginData.user.role)
      localStorage.setItem("isSuperAdmin", loginData.user.isSuperAdmin.toString())

      // Rediriger selon le rôle
      if (loginData.user.role === 'employee') {
        router.push("/employee")
      } else {
        router.push("/admin")
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création du mot de passe. Veuillez réessayer.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center space-x-2">
            <Key className="h-6 w-6 text-green-600" />
            <span>Créer votre mot de passe</span>
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Email: <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500">Créez un mot de passe sécurisé pour votre première connexion</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Créez un mot de passe sécurisé"
                  className="h-12 pr-12 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmez votre mot de passe"
                  className="h-12 pr-12 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            {/* Indicateurs de validation */}
            <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Critères du mot de passe :</p>
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-sm">
                  {validation.minLength ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={
                      validation.minLength ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    }
                  >
                    Au moins 6 caractères
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  {validation.hasLetter ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={
                      validation.hasLetter
                        ? "text-green-700 dark:text-green-400"
                        : "text-red-700 dark:text-red-400"
                    }
                  >
                    Au moins une lettre
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  {validation.hasNumber ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={
                      validation.hasNumber ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    }
                  >
                    Au moins un chiffre
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  {passwordsMatch ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={passwordsMatch ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}
                  >
                    Les mots de passe correspondent
                  </span>
                </div>
              </div>

              {/* Indicateur de force */}
              {password.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Force :</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          validation.strength === "weak"
                            ? "w-1/3 bg-red-500"
                            : validation.strength === "medium"
                              ? "w-2/3 bg-yellow-500"
                              : "w-full bg-green-500"
                        }`}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        validation.strength === "weak"
                          ? "text-red-600 dark:text-red-400"
                          : validation.strength === "medium"
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {validation.strength === "weak" ? "Faible" : validation.strength === "medium" ? "Moyen" : "Fort"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !validation.isValid || !passwordsMatch}
              className="w-full h-12 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Création...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Key className="h-4 w-4" />
                  <span>Créer mon mot de passe</span>
                </div>
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>🔐 Votre mot de passe sera chiffré et sécurisé</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
