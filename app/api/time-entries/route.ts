import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'
import { verifyAuth, verifyManagerOrAdmin } from '@/lib/auth-middleware'

// GET - Récupérer les pointages
export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    let userEmail = searchParams.get('user_email')
    const gymId = searchParams.get('gym_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    // Un employé standard ne peut consulter que ses propres pointages, jamais ceux de collègues.
    const managerAuth = await verifyManagerOrAdmin(request)
    if (!managerAuth) {
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      userEmail = actor?.email || null
    }

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
      { data: null, error: 'Erreur lors de la récupération' },
      { status: 500 }
    )
  }
}

// POST - Créer un pointage
export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Authentification requise' }, { status: 401 })
  }

  try {
    let { user_email, gym_id } = await request.json()

    // Un employé standard ne peut pointer que pour lui-même — sinon il pourrait
    // créer un pointage (donc potentiellement une base de paie) au nom d'un collègue.
    const managerAuth = await verifyManagerOrAdmin(request)
    if (!managerAuth) {
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (!actor) {
        return NextResponse.json({ data: null, error: 'Utilisateur introuvable' }, { status: 401 })
      }
      user_email = actor.email
    }

    if (!user_email || !gym_id) {
      return NextResponse.json(
        { data: null, error: 'Email utilisateur et ID salle requis' },
        { status: 400 }
      )
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: user_email }
    })
    
    if (!user) {
      return NextResponse.json(
        { data: null, error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }
    
    // Vérifier que l'utilisateur a accès au pointage simple (pas d'accès au planning)
    // Note: hasWorkScheduleAccess sera disponible après régénération du client Prisma
    // @ts-ignore - Le champ existe dans le schéma mais le client doit être régénéré
    if ((user as any).hasWorkScheduleAccess) {
      return NextResponse.json(
        { data: null, error: 'Utilisez le planning de travail pour cet employé' },
        { status: 403 }
      )
    }
    
    // Créer le pointage
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
      { data: null, error: 'Erreur lors du pointage' },
      { status: 500 }
    )
  }
}
