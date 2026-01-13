"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, Shield } from "lucide-react"

interface AdminHeaderProps {
  userEmail: string
}

export function AdminHeader({ userEmail }: AdminHeaderProps) {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("userRole")
    localStorage.removeItem("userEmail")
    router.push("/")
  }

  return (
    <header className="bg-gradient-to-r from-red-600 to-black shadow-lg border-b-4 border-red-700">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-white" />
          <div>
            <h1 className="text-xl font-bold text-white">Panneau Administrateur</h1>
            <p className="text-sm text-gray-200">{userEmail}</p>
          </div>
        </div>
        <Button onClick={handleLogout} variant="outline" className="bg-white text-red-600 border-2 border-white hover:bg-gray-100">
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </header>
  )
}
