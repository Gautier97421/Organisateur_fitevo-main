import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Récupérer tous les rôles
export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: 'asc' }
    })
    
    return NextResponse.json({ data: roles, error: null })
  } catch (error: any) {
    console.error('Erreur GET roles:', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors de la récupération des rôles' } },
      { status: 500 }
    )
  }
}

// POST - Créer un nouveau rôle
export async function POST(request: NextRequest) {
  try {
    const { name, color } = await request.json()
    
    if (!name || !color) {
      return NextResponse.json(
        { data: null, error: { message: 'Le nom et la couleur sont requis' } },
        { status: 400 }
      )
    }
    
    // Vérifier si le rôle existe déjà
    const existing = await prisma.role.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ data: existing, error: null })
    }
    
    // Créer le rôle
    const role = await prisma.role.create({
      data: { name, color }
    })
    
    return NextResponse.json({ data: role, error: null })
  } catch (error: any) {
    console.error('Erreur POST role:', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors de la création du rôle' } },
      { status: 500 }
    )
  }
}
