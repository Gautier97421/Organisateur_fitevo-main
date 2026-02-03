import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Rechercher l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.active) {
      return NextResponse.json(
        { error: 'Email non trouvé ou compte inactif' },
        { status: 401 }
      )
    }

    // Si l'utilisateur n'a pas encore de mot de passe, rediriger vers la page de création
    if (!user.password) {
      return NextResponse.json(
        { 
          needPasswordSetup: true,
          userId: user.id 
        },
        { status: 200 }
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
