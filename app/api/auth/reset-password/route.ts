import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, validatePassword } from "@/lib/password-utils"
import logger from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 })
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json({ error: passwordValidation.errors[0] ?? "Mot de passe invalide" }, { status: 400 })
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, active: true } } },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré" },
        { status: 400 },
      )
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: "Ce lien a déjà été utilisé" },
        { status: 400 },
      )
    }

    if (new Date() > resetToken.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { token } })
      return NextResponse.json(
        { error: "Lien expiré. Veuillez refaire une demande." },
        { status: 400 },
      )
    }

    if (!resetToken.user.active) {
      return NextResponse.json(
        { error: "Compte désactivé. Contactez votre administrateur." },
        { status: 403 },
      )
    }

    const hashedPassword = await hashPassword(password)

    // Mettre à jour le mot de passe et marquer le token comme utilisé dans une transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({ message: "Mot de passe mis à jour avec succès" })
  } catch (error) {
    logger.error("Erreur reset-password", error)
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation" },
      { status: 500 },
    )
  }
}
