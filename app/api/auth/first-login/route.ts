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

export async function POST(request: NextRequest) {
  try {
    const { email, username, password } = await request.json()

    // Validation simple
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, pseudo et mot de passe requis' },
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

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: username.trim(),
        password: hashedPassword,
        isFirstLogin: false
      }
    })

    logger.info('Première connexion configurée pour:', updatedUser.email)
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

