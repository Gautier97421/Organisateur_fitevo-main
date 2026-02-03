"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Appel à l'API de connexion
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erreur de connexion")
        return
      }

      // Si l'utilisateur doit créer son mot de passe
      if (data.needPasswordSetup) {
        router.push(`/create-password?email=${encodeURIComponent(email)}`)
        return
      }

      // Stocker les informations de l'utilisateur
      localStorage.setItem("userId", data.user.id)
      localStorage.setItem("userEmail", data.user.email)
      localStorage.setItem("userName", data.user.name)
      localStorage.setItem("userRole", data.user.role)
      localStorage.setItem("isSuperAdmin", data.user.isSuperAdmin.toString())

      // Rediriger selon le rôle
      if (data.user.role === 'employee') {
        router.push("/employee")
      } else {
        router.push("/admin")
      }
    } catch (err: any) {
      setError(err.message || "Erreur de connexion")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="shadow-lg border border-gray-200 bg-white">
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Votre email"
              className="h-12 text-base border border-gray-300 focus:border-red-600 focus:ring-1 focus:ring-red-600 bg-white text-gray-900"
              required
            />
          </div>
          <div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="h-12 text-base border border-gray-300 focus:border-red-600 focus:ring-1 focus:ring-red-600 bg-white text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">Laissez vide si première connexion</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base bg-red-600 hover:bg-red-700 shadow transition-all duration-200"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Connexion...</span>
              </div>
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>

      </CardContent>
    </Card>
  )
}
