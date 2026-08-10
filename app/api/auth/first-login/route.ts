import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password-utils'
import logger from '@/lib/logger'

// Rate limiting pour la première connexion — évite le takeover de compte par brute-force
const firstLoginAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_TIME = 30 * 60 * 1000 // 30 minutes

function checkFirstLoginRateLimit(email: string): { allowed: boolean; remainingTime?: number } {
  const now = Date.now()
  const entry = firstLoginAttempts.get(email)
  if (entry) {
    if (now - entry.lastAttempt > LOCKOUT_TIME) {
      firstLoginAttempts.delete(email)
      return { allowed: true }
    }
    if (entry.count >= MAX_ATTEMPTS) {
      const remainingTime = Math.ceil((LOCKOUT_TIME - (now - entry.lastAttempt)) / 1000)
      return { allowed: false, remainingTime }
    }
  }
  return { allowed: true }
}

function recordFirstLoginAttempt(email: string, success: boolean) {
  if (success) { firstLoginAttempts.delete(email); return }
  const entry = firstLoginAttempts.get(email) || { count: 0, lastAttempt: 0 }
  firstLoginAttempts.set(email, { count: entry.count + 1, lastAttempt: Date.now() })
}

// Le jeton d'activation est-il exigé ? Piloté par le superadmin dans Paramètres.
// Absence de ligne en base = désactivé, pour ne pas bloquer une instance sans SMTP.
async function isActivationTokenRequired(): Promise<boolean> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } })
    return setting?.activationTokenRequired ?? false
  } catch (error) {
    // Une lecture qui échoue ne doit pas verrouiller les activations : on reste permissif,
    // comme le défaut, plutôt que de renvoyer une erreur incompréhensible à l'employé.
    logger.error('Erreur lecture du paramètre activation_token_required', error)
    return false
  }
}

// Permet à la page /first-login de savoir s'il faut réclamer un lien d'activation.
// Volontairement public (elle est affichée avant toute authentification) et ne divulgue
// qu'un booléen de configuration.
export async function GET() {
  return NextResponse.json({ data: { activationTokenRequired: await isActivationTokenRequired() } })
}

export async function POST(request: NextRequest) {
  try {
    const { email, username, password, token } = await request.json()

    // Validation simple
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, pseudo et mot de passe requis' },
        { status: 400 }
      )
    }

    // Le jeton d'activation (envoyé par email à la création du compte) empêche quiconque
    // connaît simplement l'adresse email d'un compte pas encore activé de se l'approprier.
    const activationTokenRequired = await isActivationTokenRequired()
    if (activationTokenRequired && (!token || typeof token !== 'string')) {
      return NextResponse.json(
        { error: 'Lien d\'activation manquant ou invalide' },
        { status: 400 }
      )
    }

    if (username.length < 3 || username.length > 50) {
      return NextResponse.json(
        { error: 'Le pseudo doit contenir entre 3 et 50 caractères' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      )
    }

    // Vérifier le rate limiting
    const rateLimit = checkFirstLoginRateLimit(email)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${rateLimit.remainingTime} secondes.` },
        { status: 429 }
      )
    }

    // Trouver l'utilisateur par email
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      recordFirstLoginAttempt(email, false)
      return NextResponse.json(
        { error: 'Identifiants incorrects' },
        { status: 401 }
      )
    }

    // Vérifier que c'est bien la première connexion
    if (!user.isFirstLogin) {
      recordFirstLoginAttempt(email, false)
      return NextResponse.json(
        { error: 'Ce compte a déjà été configuré' },
        { status: 400 }
      )
    }

    // Vérifier le jeton d'activation : doit exister, correspondre à ce compte,
    // ne pas être expiré, et ne pas avoir déjà été utilisé.
    // Sécurité désactivée : un jeton fourni quand même est consommé s'il est valide, mais
    // un jeton absent/expiré/invalide ne bloque pas l'activation.
    const activationToken = token && typeof token === 'string'
      ? await prisma.passwordResetToken.findUnique({ where: { token } })
      : null

    if (activationTokenRequired) {
      if (!activationToken || activationToken.userId !== user.id) {
        recordFirstLoginAttempt(email, false)
        return NextResponse.json(
          { error: 'Lien d\'activation invalide' },
          { status: 400 }
        )
      }
      if (activationToken.usedAt) {
        return NextResponse.json(
          { error: 'Ce lien d\'activation a déjà été utilisé' },
          { status: 400 }
        )
      }
      if (new Date() > activationToken.expiresAt) {
        return NextResponse.json(
          { error: 'Lien d\'activation expiré. Contactez un administrateur pour en recevoir un nouveau.' },
          { status: 400 }
        )
      }
    }

    // Le jeton n'est marqué comme utilisé que s'il appartient bien à ce compte et reste exploitable.
    const tokenToConsume =
      activationToken &&
      activationToken.userId === user.id &&
      !activationToken.usedAt &&
      new Date() <= activationToken.expiresAt
        ? activationToken.token
        : null

    // Vérifier que le pseudo n'est pas déjà pris
    const existingUsername = await prisma.user.findFirst({
      where: { 
        username: username,
        id: { not: user.id }
      }
    })

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Ce pseudo est déjà utilisé' },
        { status: 400 }
      )
    }

    // Hacher le mot de passe
    const hashedPassword = await hashPassword(password)

    // Mettre à jour l'utilisateur et consommer le jeton d'activation dans une transaction
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          username: username.trim(),
          password: hashedPassword,
          isFirstLogin: false
        }
      }),
      ...(tokenToConsume
        ? [prisma.passwordResetToken.update({
            where: { token: tokenToConsume },
            data: { usedAt: new Date() }
          })]
        : [])
    ])

    // RGPD: pas d'email en clair dans les logs, on utilise l'id interne.
    logger.info('Première connexion configurée pour l’utilisateur:', updatedUser.id)
    recordFirstLoginAttempt(email, true)

    return NextResponse.json({
      success: true,
      message: 'Compte configuré avec succès'
    })
  } catch (error: any) {
    logger.error('Erreur première connexion', error)
    
    // Gérer les erreurs Prisma (ex: violation de contrainte unique)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ce pseudo est déjà utilisé' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}

