"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, CheckCircle2, Clock, Loader2, LogIn, LogOut, Mail, MapPin } from "lucide-react"

interface CheckInResult {
  action: "in" | "out"
  duplicate?: boolean
  employeeName: string
  gymName: string
  checkInTime: string
  checkOutTime?: string
  duration?: string
}

function heure(iso?: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function PointagePage() {
  const searchParams = useSearchParams()
  const gymId = searchParams.get("gym") || ""

  const [step, setStep] = useState<"email" | "code" | "done">("email")
  const [identifier, setIdentifier] = useState("")
  const [code, setCode] = useState("")
  const [gymName, setGymName] = useState("")
  const [info, setInfo] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckInResult | null>(null)

  // L'identifiant est mémorisé sur le téléphone : au scan suivant, il ne reste que le code.
  useEffect(() => {
    const saved = localStorage.getItem("fitevo_pointage_identifiant")
      || localStorage.getItem("fitevo_pointage_email")
    if (saved) setIdentifier(saved)
  }, [])

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/checkin/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), gymId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Impossible d'envoyer le code")
        return
      }
      localStorage.setItem("fitevo_pointage_identifiant", identifier.trim())
      if (data.gymName) setGymName(data.gymName)
      setInfo(data.message || "")
      setStep("code")
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.")
    } finally {
      setLoading(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/checkin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), gymId, code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Code incorrect")
        return
      }
      setResult(data)
      setStep("done")
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.")
    } finally {
      setLoading(false)
    }
  }

  const restart = () => {
    setStep("email")
    setCode("")
    setResult(null)
    setInfo("")
    setError("")
  }

  if (!gymId) {
    return (
      <Shell>
        <p className="text-center text-gray-600">
          Ce lien ne désigne aucune salle. Scannez le QR code affiché dans votre salle.
        </p>
      </Shell>
    )
  }

  if (step === "done" && result) {
    const isOut = result.action === "out"
    return (
      <Shell gymName={result.gymName}>
        <div className="flex flex-col items-center text-center gap-3">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isOut ? "bg-blue-100" : "bg-green-100"}`}>
            {isOut ? <LogOut className="w-8 h-8 text-blue-700" /> : <LogIn className="w-8 h-8 text-green-700" />}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {isOut ? "Départ enregistré" : result.duplicate ? "Arrivée déjà enregistrée" : "Arrivée enregistrée"}
          </h1>
          <p className="text-gray-600">{result.employeeName}</p>
          <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
            <p className="flex items-center justify-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" /> {result.gymName}
            </p>
            <p className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Arrivée {heure(result.checkInTime)}
              {result.checkOutTime ? ` · Départ ${heure(result.checkOutTime)}` : ""}
            </p>
            {result.duration && (
              <p className="font-semibold text-gray-900">Durée : {result.duration}</p>
            )}
          </div>
          {!isOut && (
            <p className="text-xs text-gray-500">
              Rescannez le QR code en partant pour enregistrer votre départ.
            </p>
          )}
          <Button onClick={restart} variant="outline" className="w-full mt-2 border-2 rounded-xl">
            Pointer pour quelqu'un d'autre
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell gymName={gymName}>
      <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Pointage</h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        {step === "email"
          ? "Saisissez votre e-mail ou votre pseudo pour recevoir un code."
          : "Saisissez le code reçu par e-mail."}
      </p>

      {error && (
        <div className="mb-4 rounded-xl border-2 border-red-500 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700 text-center">{error}</p>
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">E-mail ou pseudo</label>
            <Input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="prenom.nom@exemple.fr ou pseudo"
              className="border-2 rounded-xl bg-white text-gray-900 h-12 text-base"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Le code arrive sur l'adresse e-mail de votre compte.
            </p>
          </div>
          <Button
            type="submit"
            disabled={loading || !identifier.trim()}
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl text-base"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
            <span className="ml-2">Recevoir mon code</span>
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-4">
          {info && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-800 text-center flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{info}</span>
              </p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Code à 6 chiffres</label>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="border-2 rounded-xl bg-white text-gray-900 h-14 text-center text-2xl tracking-[0.5em] font-mono"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl text-base"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            <span className="ml-2">Valider mon pointage</span>
          </Button>
          <button
            type="button"
            onClick={restart}
            className="w-full text-sm text-gray-500 hover:text-gray-900 flex items-center justify-center gap-1.5 py-2"
          >
            <ArrowLeft className="w-4 h-4" /> Changer d'identifiant ou renvoyer un code
          </button>
        </form>
      )}
    </Shell>
  )
}

function Shell({ children, gymName }: { children: React.ReactNode; gymName?: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm border-0 shadow-xl rounded-2xl">
        <CardContent className="p-6">
          {gymName && (
            <p className="mb-4 flex items-center justify-center gap-1.5 text-sm font-medium text-red-600">
              <MapPin className="w-4 h-4" /> {gymName}
            </p>
          )}
          {children}
        </CardContent>
      </Card>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Shell><Loader2 className="w-6 h-6 animate-spin mx-auto text-red-600" /></Shell>}>
      <PointagePage />
    </Suspense>
  )
}
