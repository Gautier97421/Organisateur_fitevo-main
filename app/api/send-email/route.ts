import { type NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'
import { auth } from '@/lib/auth'

// TODO: This endpoint is a stub — no emails are actually sent.
// Implement a real email provider (e.g. Resend, SendGrid) before using in production.
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, data } = body

    logger.info('Email envoyé:', { type, timestamp: new Date().toISOString() })

    if (type === 'emergency') {
      return NextResponse.json({
        success: true,
        message: "Alerte d'urgence envoyée",
      })
    } else if (type === 'todolist') {
      return NextResponse.json({
        success: true,
        message: 'To-do list envoyée',
      })
    }

    return NextResponse.json({
      success: false,
      message: "Type d'email non reconnu",
    })
  } catch (error) {
    logger.error('Erreur envoi email', error)
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de l'envoi",
      },
      { status: 500 },
    )
  }
}
