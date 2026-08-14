/**
 * Règles du pointage par QR code.
 *
 * Le même QR sert à l'arrivée et au départ : c'est l'état du dernier pointage de la journée
 * qui décide. Ce module est partagé par l'API (envoi du code, validation) pour que les deux
 * étapes annoncent exactement la même action à l'employé.
 */

import { prisma } from "@/lib/prisma"

/** Durée de validité d'un code reçu par email. */
export const CODE_TTL_MINUTES = 10
/** Nombre d'essais autorisés sur un même code avant de devoir en redemander un. */
export const MAX_CODE_ATTEMPTS = 5
/**
 * En dessous de ce délai, un second scan est considéré comme un double scan involontaire
 * (QR relu, page rafraîchie) et non comme un départ.
 */
export const MIN_SHIFT_MINUTES = 1

export type CheckInAction = "in" | "out"

/**
 * Retrouve l'employé à partir de ce qu'il a saisi : son adresse e-mail ou son pseudo,
 * comme sur l'écran de connexion. L'e-mail est aussi tenté en minuscules, une adresse
 * saisie au clavier d'un téléphone arrivant souvent avec une majuscule automatique.
 */
export async function findUserByIdentifier(identifier: string) {
  const raw = identifier.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  return prisma.user.findFirst({
    where: {
      OR: [{ email: raw }, { email: lower }, { username: raw }],
    },
    select: { id: true, name: true, email: true, active: true },
  })
}

/** Début de la journée locale du serveur — les pointages sont regroupés par jour. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Pointage ouvert (sans heure de sortie) de la journée pour cet employé, toutes salles
 * confondues : quelqu'un qui oublie de pointer sa sortie ne doit pas pouvoir accumuler
 * plusieurs pointages ouverts en parallèle.
 */
export async function findOpenEntry(userId: string, now: Date = new Date()) {
  return prisma.timeEntry.findFirst({
    where: {
      userId,
      checkOutTime: null,
      checkInTime: { gte: startOfToday(now) },
    },
    orderBy: { checkInTime: "desc" },
    include: { gym: { select: { name: true } } },
  })
}

/** Action que produira le prochain scan : fermer le pointage ouvert, ou en ouvrir un. */
export async function nextAction(userId: string, now: Date = new Date()): Promise<CheckInAction> {
  const open = await findOpenEntry(userId, now)
  return open ? "out" : "in"
}

/** Code numérique à 6 chiffres, tiré avec le générateur cryptographique. */
export async function generateCode(): Promise<string> {
  const { randomInt } = await import("node:crypto")
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${String(minutes).padStart(2, "0")}`
}
