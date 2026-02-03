import { LoginForm } from "@/components/auth/login-form"

export default function HomePage() {
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
        <div className="text-center mb-6 md:mb-8">
          <div className="mx-auto w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 shadow-lg">
            <img
              src="/logo_fitevo-remove.png"
              alt="FitEvo"
              className="w-14 h-14 md:w-16 md:h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Gestionnaire Salle de Sport
          </h1>
          <p className="text-gray-300 text-base md:text-lg">Connexion au système de gestion</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
