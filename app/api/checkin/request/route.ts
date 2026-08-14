import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password-utils"
import { sendCheckInCodeEmail } from "@/lib/email"
import { isValidEmail } from "@/lib/validation"
import logger from "@/lib/logger"
import { CODE_TTL_MINUTES, findUserByIdentifier, generateCode, nextAction } from "@/lib/check-in"

// Route publique (l'employé scanne le QR sans être connecté) : le rate limiting est donc la
// seule barrière contre l'usage du serveur comme relais d'emails.
const attempts = new Map<string, { count: number; firstAttempt: number }>()
const MAX_REQUESTS = 5
const WINDOW_MS = 10 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of attempts.entries()) {
    if (now - value.firstAttempt > WINDOW_MS) attempts.delete(key)
  }
}, WINDOW_MS)

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now })
    return true
  }
  if (entry.count >= MAX_REQUESTS) return false
  entry.count += 1
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // `identifier` = e-mail ou pseudo ; `email` reste accepté pour ne pas casser un onglet
    // resté ouvert sur l'ancienne version de la page.
    const identifier = String(body.identifier ?? body.email ?? "").trim()
    const gymId = body.gymId

    // Un pseudo n'a pas de format imposé : on se contente de bornes raisonnables.
    const looksLikeEmail = identifier.includes("@")
    if (!identifier || identifier.length > 100 || (looksLikeEmail && !isValidEmail(identifier)) || !gymId) {
      return NextResponse.json({ error: "Identifiant ou salle invalide" }, { status: 400 })
    }

    const rateLimitKey = identifier.toLowerCase()

    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: "Trop de demandes de code. Réessayez dans 10 minutes." },
        { status: 429 },
      )
    }

    const gym = await prisma.gym.findUnique({
      where: { id: String(gymId) },
      select: { id: true, name: true, isActive: true, qrCodeEnabled: true },
    })
    if (!gym || !gym.isActive || !gym.qrCodeEnabled) {
      return NextResponse.json({ error: "Ce QR code n'est plus actif." }, { status: 404 })
    }

    // Réponse identique quel que soit le sort de l'identifiant, pour ne pas transformer le QR
    // en moyen de tester quelles adresses ou quels pseudos ont un compte.
    const genericResponse = NextResponse.json({
      message: `Si cet identifiant correspond à un compte, un code vient d'être envoyé sur l'adresse e-mail associée. Il est valable ${CODE_TTL_MINUTES} minutes.`,
      gymName: gym.name,
    })

    const user = await findUserByIdentifier(identifier)
    if (!user || !user.active) return genericResponse

    // Un seul code valable à la fois : demander un nouveau code invalide le précédent.
    await prisma.checkInCode.deleteMany({ where: { userId: user.id, usedAt: null } })

    const code = await generateCode()
    const action = await nextAction(user.id)

    await prisma.checkInCode.create({
      data: {
        userId: user.id,
        gymId: gym.id,
        codeHash: await hashPassword(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
      },
    })

    await sendCheckInCodeEmail({
      toEmail: user.email,
      code,
      gymName: gym.name,
      minutes: CODE_TTL_MINUTES,
      action,
    })

    return genericResponse
  } catch (error) {
    logger.error("Erreur demande de code de pointage", error)
    return NextResponse.json({ error: "Erreur lors de l'envoi du code" }, { status: 500 })
  }
}
