import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password-utils"
import logger from "@/lib/logger"
import {
  MAX_CODE_ATTEMPTS,
  MIN_SHIFT_MINUTES,
  findOpenEntry,
  findUserByIdentifier,
  formatDuration,
} from "@/lib/check-in"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // `identifier` = e-mail ou pseudo (`email` toléré pour l'ancienne version de la page).
    const identifier = String(body.identifier ?? body.email ?? "").trim()
    const { gymId, code } = body

    if (!identifier || identifier.length > 100 || !gymId || !code) {
      return NextResponse.json({ error: "Informations de pointage incomplètes" }, { status: 400 })
    }

    const submitted = String(code).replace(/\s/g, "")

    const user = await findUserByIdentifier(identifier)
    // Même message que pour un code faux : sans compte valide, il n'y a rien à distinguer.
    if (!user || !user.active) {
      return NextResponse.json({ error: "Code incorrect ou expiré" }, { status: 400 })
    }

    const pending = await prisma.checkInCode.findFirst({
      where: { userId: user.id, gymId: String(gymId), usedAt: null },
      orderBy: { createdAt: "desc" },
    })
    if (!pending || pending.expiresAt < new Date()) {
      return NextResponse.json({ error: "Code incorrect ou expiré" }, { status: 400 })
    }
    if (pending.attempts >= MAX_CODE_ATTEMPTS) {
      return NextResponse.json(
        { error: "Trop d'essais sur ce code. Demandez-en un nouveau." },
        { status: 429 },
      )
    }

    if (!(await verifyPassword(submitted, pending.codeHash))) {
      await prisma.checkInCode.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      })
      return NextResponse.json({ error: "Code incorrect ou expiré" }, { status: 400 })
    }

    const gym = await prisma.gym.findUnique({
      where: { id: String(gymId) },
      select: { id: true, name: true, isActive: true, qrCodeEnabled: true },
    })
    if (!gym || !gym.isActive || !gym.qrCodeEnabled) {
      return NextResponse.json({ error: "Ce QR code n'est plus actif." }, { status: 404 })
    }

    const now = new Date()
    const open = await findOpenEntry(user.id, now)

    // Le code est consommé quoi qu'il arrive ensuite : il ne doit jamais servir deux fois.
    await prisma.checkInCode.update({ where: { id: pending.id }, data: { usedAt: now } })

    if (open) {
      const elapsedMs = now.getTime() - open.checkInTime.getTime()
      // Deuxième scan quasi immédiat : c'est un doublon, pas une fin de service. On confirme
      // l'arrivée déjà enregistrée au lieu de clôturer un pointage de zéro minute.
      if (elapsedMs < MIN_SHIFT_MINUTES * 60 * 1000) {
        return NextResponse.json({
          action: "in",
          duplicate: true,
          employeeName: user.name,
          gymName: open.gym?.name || gym.name,
          checkInTime: open.checkInTime.toISOString(),
        })
      }

      const closed = await prisma.timeEntry.update({
        where: { id: open.id },
        data: { checkOutTime: now },
      })

      return NextResponse.json({
        action: "out",
        employeeName: user.name,
        gymName: open.gym?.name || gym.name,
        checkInTime: closed.checkInTime.toISOString(),
        checkOutTime: now.toISOString(),
        duration: formatDuration(elapsedMs),
      })
    }

    await prisma.timeEntry.create({
      data: {
        userId: user.id,
        gymId: gym.id,
        employeeName: user.name,
        employeeEmail: user.email,
        checkInTime: now,
        source: "qr",
      },
    })

    return NextResponse.json({
      action: "in",
      employeeName: user.name,
      gymName: gym.name,
      checkInTime: now.toISOString(),
    })
  } catch (error) {
    logger.error("Erreur validation du pointage", error)
    return NextResponse.json({ error: "Erreur lors du pointage" }, { status: 500 })
  }
}
