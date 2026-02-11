import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password-utils'
import logger from '@/lib/logger'

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

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    // Trouver l'utilisateur par email
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Vérifier que c'est bien la première connexion
    if (!user.isFirstLogin) {
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

