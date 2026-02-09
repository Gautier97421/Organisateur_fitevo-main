import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Récupérer les pointages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userEmail = searchParams.get('user_email')
    const gymId = searchParams.get('gym_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    
    const where: any = {}
    
    if (userEmail) {
      where.employeeEmail = userEmail
    }
    
    if (gymId) {
      where.gymId = gymId
    }
    
    if (dateFrom) {
      where.checkInTime = { gte: new Date(dateFrom) }
    }
    
    if (dateTo) {
      where.checkInTime = { ...where.checkInTime, lte: new Date(dateTo) }
    }
    
    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: { checkInTime: 'desc' },
      include: {
        user: true,
        gym: true
      }
    })
    
    return NextResponse.json({ data: entries, error: null })
  } catch (error: any) {
    console.error('Erreur GET time_entries:', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors de la récupération' } },
      { status: 500 }
    )
  }
}

// POST - Créer un pointage
export async function POST(request: NextRequest) {
  try {
    const { user_email, gym_id } = await request.json()
    
    if (!user_email || !gym_id) {
      return NextResponse.json(
        { data: null, error: { message: 'Email utilisateur et ID salle requis' } },
        { status: 400 }
      )
    }
    
    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({ 
      where: { email: user_email },
      include: { employeeRole: true }
    })
    
    if (!user) {
      return NextResponse.json(
        { data: null, error: { message: 'Utilisateur non trouvé' } },
        { status: 404 }
      )
    }
    
    // Vérifier que l'utilisateur a accès au pointage simple (pas d'accès au planning)
    if (user.hasWorkScheduleAccess) {
      return NextResponse.json(
        { data: null, error: { message: 'Utilisez le planning de travail pour cet employé' } },
        { status: 403 }
      )
    }
    
    // Créer le pointage
    const entry = await prisma.timeEntry.create({
      data: {
        userId: user.id,
        gymId: gym_id,
        employeeName: user.name,
        employeeEmail: user.email,
        checkInTime: new Date()
      },
      include: {
        gym: true
      }
    })
    
    return NextResponse.json({ data: entry, error: null })
  } catch (error: any) {
    console.error('Erreur POST time_entry:', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors du pointage' } },
      { status: 500 }
    )
  }
}
