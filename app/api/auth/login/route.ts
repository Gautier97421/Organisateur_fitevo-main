import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json()

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
      return NextResponse.json(
        { error: 'Identifiant non trouvé ou compte inactif' },
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
        { error: 'Configuration du compte incomplète. Veuillez contacter un administrateur.' },
        { status: 401 }
      )
    }

    // Vérification simple du mot de passe (en production, utiliser bcrypt)
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Mot de passe incorrect' },
        { status: 401 }
      )
    }

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
    console.error('Erreur de connexion:', error)
    return NextResponse.json(
      { error: 'Erreur de connexion' },
      { status: 500 }
    )
  }
}
