"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { Download, QrCode as QrCodeIcon } from "lucide-react"

interface QRCodeDisplayProps {
  gymId: string
  gymName: string
  siteUrl?: string
}

export function QRCodeDisplay({ gymId, gymName, siteUrl }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrUrl, setQrUrl] = useState("")

  useEffect(() => {
    const generateQR = async () => {
      if (!canvasRef.current) return

      // Page de pointage dédiée : elle s'ouvre sans compte connecté, l'employé s'identifie
      // avec un code reçu par email.
      const base = (siteUrl || window.location.origin).replace(/\/+$/, "")
      const url = `${base}/pointage?gym=${gymId}`
      setQrUrl(url)

      try {
        await QRCode.toCanvas(canvasRef.current, url, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF"
          }
        })
      } catch (error) {
      }
    }

    generateQR()
  }, [gymId, siteUrl])

  const downloadQRCode = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const url = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.download = `qr-code-${gymName.replace(/\s+/g, "-").toLowerCase()}.png`
    link.href = url
    link.click()
  }

  return (
    <div className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-gray-200 shadow-md w-full max-w-xs">
      <div className="flex items-center gap-2 text-red-600 font-semibold">
        <QrCodeIcon className="h-5 w-5" />
        <span className="truncate">QR Code — {gymName}</span>
      </div>
      <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
        <canvas ref={canvasRef} className="rounded-lg block" />
      </div>
      <p className="text-xs text-gray-500 text-center leading-snug">
        À afficher en salle : les employés le scannent pour pointer leur arrivée, puis leur départ.
      </p>
      {qrUrl && <p className="text-[10px] text-gray-400 break-all text-center">{qrUrl}</p>}
      <Button
        onClick={downloadQRCode}
        variant="outline"
        size="sm"
        className="w-full border-2 border-red-600 text-red-600 hover:bg-red-50 rounded-xl"
      >
        <Download className="h-4 w-4 mr-2" />
        Télécharger
      </Button>
    </div>
  )
}
