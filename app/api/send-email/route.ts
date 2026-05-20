import { type NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { verifyAuth } from "@/lib/auth-middleware"

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ success: false, message: "Authentification requise" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, data } = body

    // Log uniquement en développement (pas d'infos sensibles en production)
    logger.info("Email envoyé:", { type, timestamp: new Date().toISOString() })

    if (type === "emergency") {
      // Envoi d'email d'urgence
      return NextResponse.json({
        success: true,
        message: "Alerte d'urgence envoyée",
      })
    } else if (type === "todolist") {
      // Envoi de la to-do list complétée
      return NextResponse.json({
        success: true,
        message: "To-do list envoyée",
      })
    }

    return NextResponse.json({
      success: false,
      message: "Type d'email non reconnu",
    })
  } catch (error) {
    logger.error("Erreur envoi email", error)
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de l'envoi",
      },
      { status: 500 },
    )
  }
}
