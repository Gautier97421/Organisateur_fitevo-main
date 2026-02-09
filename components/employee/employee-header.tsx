"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, User, MessageCircle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

interface EmployeeHeaderProps {
  userEmail: string
}

export function EmployeeHeader({ userEmail }: EmployeeHeaderProps) {
  const router = useRouter()
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null)

  useEffect(() => {
    // Charger le lien WhatsApp depuis la configuration
    const loadWhatsappLink = async () => {
      try {
        const response = await fetch('/api/db/app_config?key=whatsapp_link')
        const data = await response.json()
        if (data.data && data.data.length > 0 && data.data[0].value) {
          setWhatsappLink(data.data[0].value)
        }
      } catch (error) {
        console.error('Erreur lors du chargement du lien WhatsApp:', error)
      }
    }
    loadWhatsappLink()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("userRole")
    localStorage.removeItem("userEmail")
    router.push("/")
  }

  const handleWhatsappClick = () => {
    if (whatsappLink) {
      window.open(whatsappLink, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <header className="bg-gradient-to-r from-red-600 to-black shadow-lg border-b-4 border-red-700">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <User className="h-8 w-8 text-white" />
          <div>
            <h1 className="text-xl font-bold text-white">Espace Employé</h1>
            <p className="text-sm text-gray-200">{userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {whatsappLink && (
            <Button
              onClick={handleWhatsappClick}
              variant="outline"
              className="bg-green-500 text-white border-2 border-green-500 hover:bg-green-600"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
          )}
          <Button onClick={handleLogout} variant="outline" className="bg-white text-red-600 border-2 border-white hover:bg-gray-100">
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </div>
    </header>
  )
}
