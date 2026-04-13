'use client'

import type React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'

export function LoginForm() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: identifier,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Identifiants incorrects')
        return
      }

      const session = await fetch('/api/auth/session').then((r) => r.json())
      const role = session?.user?.role

      if (role === 'employee') {
        router.push('/employee')
      } else {
        router.push('/admin')
      }
      router.refresh()
    } catch {
      setError('Erreur de connexion')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200 bg-white shadow-lg dark:bg-gray-800">
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email ou pseudo"
              className="h-12 border border-gray-300 bg-white text-base text-gray-900 focus:border-red-600 focus:ring-1 focus:ring-red-600 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          <div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="h-12 border border-gray-300 bg-white pr-12 text-base text-gray-900 focus:border-red-600 focus:ring-1 focus:ring-red-600 dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="h-12 w-full bg-red-600 text-base shadow transition-all duration-200 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Connexion...</span>
              </div>
            ) : (
              'Se connecter'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
