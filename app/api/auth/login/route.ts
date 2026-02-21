import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password-utils'
import logger from '@/lib/logger'
import { isValidEmail, isValidString } from '@/lib/validation'

// Rate limiting en mémoire — suffisant pour une instance unique (standalone)
// Les compteurs sont perdus au redémarrage, ce qui est acceptable
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_TIME = 15 * 60 * 1000 // 15 minutes
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 heure

// Nettoyage périodique pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.lastAttempt > LOCKOUT_TIME) {
      loginAttempts.delete(key)
    }
  }
}, CLEANUP_INTERVAL)

function checkRateLimit(identifier: string): { allowed: boolean; remainingTime?: number } {
  const now = Date.now()
  const attempts = loginAttempts.get(identifier)
  
  if (attempts) {
    // Nettoyer si le lockout est expiré
    if (now - attempts.lastAttempt > LOCKOUT_TIME) {
      loginAttempts.delete(identifier)
      return { allowed: true }
    }
    
    if (attempts.count >= MAX_ATTEMPTS) {
      const remainingTime = Math.ceil((LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000)
      return { allowed: false, remainingTime }
    }
  }
  
  return { allowed: true }
}

function recordLoginAttempt(identifier: string, success: boolean) {
  if (success) {
    loginAttempts.delete(identifier)
    return
  }
  
  const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 }
  loginAttempts.set(identifier, {
    count: attempts.count + 1,
    lastAttempt: Date.now()
  })
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json()
    
    // Validation des entrées
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Identifiant et mot de passe requis' },
        { status: 400 }
      )
    }
    
    // Valider le format de l'identifiant (email ou username)
    if (!isValidEmail(identifier) && !isValidString(identifier, 1, 100)) {
      return NextResponse.json(
        { error: 'Format d\'identifiant invalide' },
        { status: 400 }
      )
    }
    
    // Valider la longueur du mot de passe
    if (!isValidString(password, 1, 255)) {
      return NextResponse.json(
        { error: 'Format de mot de passe invalide' },
        { status: 400 }
      )
    }

    // Vérifier le rate limiting
    const rateLimit = checkRateLimit(identifier)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${rateLimit.remainingTime} secondes.` },
        { status: 429 }
      )
    }

    // Rechercher l'utilisateur par email ou username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ]
      }
    })

    if (!user || !user.active) {
      recordLoginAttempt(identifier, false)
      return NextResponse.json(
        { error: 'Identifiants incorrects' },
        { status: 401 }
      )
    }

    // Si c'est la première connexion, rediriger vers la page de configuration
    if (user.isFirstLogin) {
      return NextResponse.json(
        { 
          isFirstLogin: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        },
        { status: 200 }
      )
    }

    // Si l'utilisateur n'a pas de mot de passe mais isFirstLogin est false, c'est une erreur
    if (!user.password) {
      return NextResponse.json(
        { error: 'Configuration du compte incomplète. Contactez un administrateur.' },
        { status: 401 }
      )
    }

    // Vérification sécurisée du mot de passe avec hash
    const isPasswordValid = await verifyPassword(password, user.password)
    
    if (!isPasswordValid) {
      recordLoginAttempt(identifier, false)
      return NextResponse.json(
        { error: 'Identifiants incorrects' },
        { status: 401 }
      )
    }

    // Succès - enregistrer et retourner les informations
    recordLoginAttempt(identifier, true)
    
    logger.info('Connexion réussie pour:', user.email)

    // Retourner les informations de l'utilisateur
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.role === 'superadmin',
      },
    })
  } catch (error) {
    logger.error('Erreur de connexion', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}
