import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import { isManagerTier } from '@/lib/db-access-control'
import logger from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const { id } = await params

    const schedule = await prisma.workSchedule.findUnique({
      where: { id },
      include: { user: true, gym: true }
    })

    if (!schedule) {
      return NextResponse.json({ data: null, error: { code: 'PGRST116' } })
    }

    // Employé standard ne peut voir que ses propres horaires
    const managerTier = await isManagerTier(auth.userId, auth.role)
    if (!managerTier && schedule.userId !== auth.userId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const mapped = {
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
    }

    return NextResponse.json({ data: mapped, error: null })
  } catch (error: any) {
    logger.error('Erreur GET work_schedules/[id]', error)
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    // Vérifier que la ligne existe et que l'employé a le droit de la modifier
    const existing = await prisma.workSchedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ data: null, error: { message: 'Introuvable' } }, { status: 404 })
    }

    const managerTier = await isManagerTier(auth.userId, auth.role)
    if (!managerTier && existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Convertir snake_case à camelCase
    const converted: any = {}
    if (body.work_date) converted.date = new Date(body.work_date)
    if (body.start_time) converted.startTime = body.start_time
    if (body.end_time) converted.endTime = body.end_time
    if (body.end_date) converted.endDate = new Date(body.end_date)
    if (body.break_duration !== undefined) converted.breakDuration = body.break_duration
    if (body.break_start_time) converted.breakStartTime = body.break_start_time
    if (body.label) converted.label = body.label

    // VALIDATION : Les congés ne doivent pas chevaucher un événement
    if ((converted.label || existing.label) === 'conges') {
      const startDate = converted.date || existing.date
      const endDate = converted.endDate || existing.endDate
      if (endDate) {
        const conflictingEvent = await prisma.scheduledEvent.findFirst({
          where: {
            eventDate: { gte: startDate },
            OR: [
              { eventDate: { lte: endDate } }
            ],
            assignedEmployeeEmail: existing.employeeEmail
          }
        })

        if (conflictingEvent) {
          return NextResponse.json(
            {
              data: null,
              error: {
                message: `Impossible de modifier les congés : un événement est prévu pendant cette période (${conflictingEvent.title})`
              }
            },
            { status: 409 }
          )
        }
      }
    }

    const updated = await prisma.workSchedule.update({
      where: { id },
      data: converted,
      include: { user: true, gym: true }
    })

    const mapped = {
      id: updated.id,
      work_date: updated.date,
      employee_email: updated.employeeEmail,
      employee_name: updated.employeeName,
      gym_id: updated.gymId,
      start_time: updated.startTime,
      end_time: updated.endTime,
      end_date: updated.endDate,
      break_duration: updated.breakDuration,
      break_start_time: updated.breakStartTime,
      label: updated.label,
      period: updated.period,
      sub_period: updated.subPeriod,
      type: updated.type,
      status: updated.status,
      notes: updated.notes,
      is_temporary: updated.isTemporary,
      tasks_completed: updated.tasksCompleted,
      total_tasks: updated.totalTasks,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt
    }

    return NextResponse.json({ data: mapped, error: null })
  } catch (error: any) {
    logger.error('Erreur PATCH work_schedules/[id]', error)
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const { id } = await params

    const existing = await prisma.workSchedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ data: null, error: { message: 'Introuvable' } }, { status: 404 })
    }

    const managerTier = await isManagerTier(auth.userId, auth.role)
    if (!managerTier && existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    await prisma.workSchedule.delete({ where: { id } })

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error: any) {
    logger.error('Erreur DELETE work_schedules/[id]', error)
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 })
  }
}
