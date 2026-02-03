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

      // Construire l'URL avec l'ID de la salle
      const url = siteUrl ? `${siteUrl}?gym=${gymId}` : `${window.location.origin}?gym=${gymId}`
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
        console.error("Erreur génération QR Code:", error)
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
    <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border-2 border-blue-200">
      <div className="flex items-center gap-2 text-blue-700 font-semibold">
        <QrCodeIcon className="h-5 w-5" />
        <span>QR Code - {gymName}</span>
      </div>
      <canvas ref={canvasRef} className="border-2 border-gray-200 rounded-lg" />
      <p className="text-xs text-gray-600 text-center max-w-[200px]">
        {qrUrl}
      </p>
      <Button
        onClick={downloadQRCode}
        variant="outline"
        size="sm"
        className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
      >
        <Download className="h-4 w-4 mr-2" />
        Télécharger
      </Button>
    </div>
  )
}
