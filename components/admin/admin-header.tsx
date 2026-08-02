"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, Shield } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { clearCurrentUser } from "@/lib/current-user"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AdminHeaderProps {
  userEmail: string
}

export function AdminHeader({ userEmail }: AdminHeaderProps) {
  const router = useRouter()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleLogoutConfirm = () => {
    clearCurrentUser()
    router.push("/")
  }

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true)
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button onClick={handleLogoutClick} variant="outline" className="bg-white text-red-600 border-2 border-white hover:bg-gray-100">
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>

          <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Déconnexion</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous certain de vouloir vous déconnecter ?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-4">
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogoutConfirm} className="bg-red-600 hover:bg-red-700">
                  Déconnectez-moi
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  )
}
