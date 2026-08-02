import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { isManagerTier } from '@/lib/db-access-control'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const { data } = await request.json()
    if (!data) {
      return NextResponse.json({ data: null, error: { message: 'Aucune donnée fournie' } }, { status: 400 })
    }

    const items = Array.isArray(data) ? data : [data]
    const results = []

    const managerTier = await isManagerTier(auth.userId, auth.role)

    for (const item of items) {
      const workDate = typeof item.work_date === 'string'
        ? new Date(item.work_date)
        : item.work_date

      // Convertir snake_case à camelCase
      const converted: any = { ...item }
      if (item.work_date) converted.date = workDate
      if (item.employee_email) converted.employeeEmail = item.employee_email
      if (item.employee_name) converted.employeeName = item.employee_name
      if (item.gym_id) converted.gymId = item.gym_id
      if (item.start_time) converted.startTime = item.start_time
      if (item.end_time) converted.endTime = item.end_time
      if (item.end_date) converted.endDate = new Date(item.end_date)
      if (item.break_duration) converted.breakDuration = item.break_duration
      if (item.break_start_time) converted.breakStartTime = item.break_start_time
      if (item.is_temporary !== undefined) converted.isTemporary = item.is_temporary
      if (item.sub_period) converted.subPeriod = item.sub_period
      if (item.tasks_completed !== undefined) converted.tasksCompleted = item.tasks_completed
      if (item.total_tasks !== undefined) converted.totalTasks = item.total_tasks

      // Trouver l'utilisateur par email
      const user = await prisma.user.findUnique({ where: { email: converted.employeeEmail } })
      if (!user) {
        return NextResponse.json({ data: null, error: { message: 'Utilisateur non trouvé' } }, { status: 404 })
      }

      converted.userId = user.id

      // Validation : un employé standard ne peut créer des congés que pour lui-même
      if (!managerTier && converted.userId !== auth.userId) {
        return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
      }

      // VALIDATION : Les congés ne doivent pas chevaucher un événement auquel l'employé est assigné
      if ((converted.label || 'travail') === 'conges' && converted.endDate) {
        const conflictingEvent = await prisma.scheduledEvent.findFirst({
          where: {
            eventDate: { gte: converted.date },
            OR: [
              { eventDate: { lte: converted.endDate } },
              { assignedEmployeeEmail: user.email }
            ]
          }
        })

        if (conflictingEvent) {
          return NextResponse.json(
            {
              data: null,
              error: {
                message: `Impossible de créer des congés : un événement est prévu pendant cette période (${conflictingEvent.title})`
              }
            },
            { status: 409 }
          )
        }
      }

      // Créer la ligne
      const created = await prisma.workSchedule.create({
        data: {
          ...converted,
          user: { connect: { id: converted.userId } },
          ...(converted.gymId && { gym: { connect: { id: converted.gymId } } })
        }
      })

      results.push(created)
    }

    return NextResponse.json({ data: results, error: null })
  } catch (error: any) {
    logger.error('Erreur POST work_schedules', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors de la création' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const where: any = {}

    // Filtres de date
    const workDateGte = searchParams.get('work_date_gte')
    const workDateLte = searchParams.get('work_date_lte')
    const gymId = searchParams.get('gym_id')

    if (workDateGte || workDateLte) {
      where.date = {}
      if (workDateGte) where.date.gte = new Date(workDateGte)
      if (workDateLte) where.date.lte = new Date(workDateLte)
    }

    if (gymId) {
      where.gymId = gymId
    }

    // Pour un employé standard :
    // - voir ses propres horaires (tous types)
    // - voir les horaires du calendrier permanent (is_temporary = false) de tous
    // Mais ne pas voir les horaires temporaires des autres
    const managerTier = await isManagerTier(auth.userId, auth.role)
    if (!managerTier) {
      where.OR = [
        { userId: auth.userId }, // Ses propres horaires
        { isTemporary: false }    // Horaires permanents du calendrier
      ]
    }

    const data = await prisma.workSchedule.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { user: true, gym: true }
    })

    // Mapper de camelCase à snake_case pour le client
    const mapped = data.map(schedule => ({
      id: schedule.id,
      work_date: schedule.date,
      employee_email: schedule.employeeEmail,
      employee_name: schedule.employeeName,
      gym_id: schedule.gymId,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      end_date: schedule.endDate,
      break_duration: schedule.breakDuration,
      break_start_time: schedule.breakStartTime,
      label: schedule.label,
      period: schedule.period,
      sub_period: schedule.subPeriod,
      type: schedule.type,
      status: schedule.status,
      notes: schedule.notes,
      is_temporary: schedule.isTemporary,
      tasks_completed: schedule.tasksCompleted,
      total_tasks: schedule.totalTasks,
      created_at: schedule.createdAt,
      updated_at: schedule.updatedAt
    }))

    return NextResponse.json({ data: mapped, error: null })
  } catch (error: any) {
    logger.error('Erreur GET work_schedules', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors du chargement' } },
      { status: 500 }
    )
  }
}
