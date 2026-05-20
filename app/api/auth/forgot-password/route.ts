import { type NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/email"
import logger from "@/lib/logger"
import { isValidEmail } from "@/lib/validation"

// Rate limiting : 3 demandes par email par 15 minutes
const resetAttempts = new Map<string, { count: number; firstAttempt: number }>()
const MAX_REQUESTS = 3
const WINDOW_MS = 15 * 60 * 1000 // 15 min
const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 heure

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of resetAttempts.entries()) {
    if (now - value.firstAttempt > WINDOW_MS) resetAttempts.delete(key)
  }
}, WINDOW_MS)

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const entry = resetAttempts.get(email)

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    resetAttempts.set(email, { count: 1, firstAttempt: now })
    return true
  }

  if (entry.count >= MAX_REQUESTS) return false

  entry.count += 1
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Adresse email invalide" },
        { status: 400 },
      )
    }

    const normalizedEmail = String(email).toLowerCase().trim()

    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez dans 15 minutes." },
        { status: 429 },
      )
    }

    // Réponse toujours identique pour ne pas révéler si l'email existe
    const genericResponse = NextResponse.json({
      message: "Si cet email est enregistré, un lien de réinitialisation a été envoyé.",
    })

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, active: true },
    })

    if (!user || !user.active) {
      return genericResponse
    }

    // Supprimer les tokens existants non utilisés pour cet utilisateur
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    })

    // Générer un token cryptographiquement sûr
    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail(user.email, resetUrl)

    return genericResponse
  } catch (error) {
    logger.error("Erreur forgot-password", error)
    return NextResponse.json(
      { error: "Erreur lors du traitement de la demande" },
      { status: 500 },
    )
  }
}
