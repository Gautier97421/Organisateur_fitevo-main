import { LoginForm } from "@/components/auth/login-form"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-3 md:p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
          <div className="mx-auto w-16 h-16 md:w-20 md:h-20 bg-red-600 rounded-full flex items-center justify-center mb-3 md:mb-4 shadow-lg">
            <span className="text-2xl md:text-3xl">🏋️</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Gestionnaire Salle de Sport
          </h1>
          <p className="text-gray-600 text-base md:text-lg">Connexion au système de gestion</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
