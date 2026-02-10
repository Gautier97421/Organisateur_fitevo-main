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
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <User className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">Espace Employé</h1>
            <p className="text-xs sm:text-sm text-gray-200">{userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ThemeToggle />
          {whatsappLink && (
            <Button
              onClick={handleWhatsappClick}
              variant="outline"
              className="bg-green-500 text-white border-2 border-green-500 hover:bg-green-600 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap"
            >
              <MessageCircle className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              WhatsApp
            </Button>
          )}
          <Button onClick={handleLogout} variant="outline" className="bg-white text-red-600 border-2 border-white hover:bg-gray-100 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
            <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Déconnexion
          </Button>
        </div>
      </div>
    </header>
  )
}
