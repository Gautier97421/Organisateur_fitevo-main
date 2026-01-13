import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    // Simulation d'envoi d'email
    // Dans un vrai projet, vous utiliseriez un service comme SendGrid, Nodemailer, etc.

    console.log("Email envoyé:", {
      type,
      data,
      timestamp: new Date().toISOString(),
    })

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
    console.error("Erreur envoi email:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de l'envoi",
      },
      { status: 500 },
    )
  }
}
