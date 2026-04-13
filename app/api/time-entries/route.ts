import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import logger from '@/lib/logger'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const userEmail = searchParams.get('user_email')
    const gymId = searchParams.get('gym_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    
    const where: any = {}
    
    const isAdmin = ['admin', 'superadmin'].includes(session.user.role)
    if (isAdmin && userEmail) {
      where.employeeEmail = userEmail
    } else if (!isAdmin) {
      where.userId = session.user.id
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
    
    // @ts-ignore - Le modèle TimeEntry existe dans le schéma mais le client doit être régénéré
    const entries = await (prisma as any).timeEntry.findMany({
      where,
      orderBy: { checkInTime: 'desc' },
      include: {
        user: true,
        gym: true
      }
    })
    
    return NextResponse.json({ data: entries, error: null })
  } catch (error: any) {
    logger.error('Erreur GET time_entries', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors de la récupération' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { user_email, gym_id } = await request.json()
    
    if (!user_email || !gym_id) {
      return NextResponse.json(
        { data: null, error: { message: 'Email utilisateur et ID salle requis' } },
        { status: 400 }
      )
    }
    
    const user = await prisma.user.findUnique({ 
      where: { email: user_email }
    })
    
    if (!user) {
      return NextResponse.json(
        { data: null, error: { message: 'Utilisateur non trouvé' } },
        { status: 404 }
      )
    }
    
    // @ts-ignore - Le champ existe dans le schéma mais le client doit être régénéré
    if ((user as any).hasWorkScheduleAccess) {
      return NextResponse.json(
        { data: null, error: { message: 'Utilisez le planning de travail pour cet employé' } },
        { status: 403 }
      )
    }
    
    // @ts-ignore - Le modèle TimeEntry existe dans le schéma mais le client doit être régénéré
    const entry = await (prisma as any).timeEntry.create({
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
    logger.error('Erreur POST time_entry', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors du pointage' } },
      { status: 500 }
    )
  }
}
