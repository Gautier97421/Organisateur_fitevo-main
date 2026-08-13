import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password-utils'
import logger from '@/lib/logger'
import { verifyAuthWithRole } from '@/lib/auth-middleware'
import {
  isKnownTable,
  resolvePrismaModel,
  USER_TABLES,
  ADMIN_ONLY_TABLES,
  MANAGER_TABLES,
  OWNER_TABLES,
  PROTECTED_USER_FIELDS,
  PROTECTED_EVENT_FIELDS,
  isAdminRole,
  isManagerTier,
  stripFields,
  omitPassword,
  findAssignedEventConflict,
} from '@/lib/db-access-control'

/**
 * Un planning reste modifiable tant que son dernier jour n'est pas passé (date de fin pour
 * un congé, jour travaillé sinon).
 *
 * La date enregistrée est un minuit local converti en UTC par le client : sa valeur dépend
 * donc du fuseau du navigateur, que le serveur ne connaît pas (en UTC+2, le 13 août est
 * stocké au 12). Le contrôle exact à la journée est fait côté client ; ici on garde une
 * tolérance d'un jour pour ne jamais refuser une modification légitime du jour même, tout
 * en bloquant la réécriture d'un planning franchement passé.
 */
function isScheduleStillEditable(record: { date: Date; endDate?: Date | null; label?: string | null }): boolean {
  const dayKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

  const limit = new Date()
  limit.setUTCDate(limit.getUTCDate() - 1)
  const earliestEditableDay = dayKey(limit)

  const start = dayKey(record.date)
  let lastDay = start
  if ((record.label || 'travail') === 'conges' && record.endDate) {
    const end = dayKey(record.endDate)
    if (end > start) lastDay = end
  }

  return lastDay >= earliestEditableDay
}

// Mapper les champs du client vers le schéma Prisma
function mapFieldsFromClient(table: string, data: any): any {
  const mapped = { ...data }

  if (table === 'users' || table === 'admins' || table === 'employees') {
    if (mapped.is_first_login !== undefined) {
      mapped.isFirstLogin = mapped.is_first_login
      delete mapped.is_first_login
    }
    if (mapped.remote_work_enabled !== undefined) {
      mapped.remoteWorkEnabled = mapped.remote_work_enabled
      delete mapped.remote_work_enabled
    }
    // Supprimer employee_role et role_color car ils n'existent plus comme champs directs
    // Le rôle est maintenant une relation via roleId
    if (mapped.employee_role !== undefined) {
      delete mapped.employee_role
    }
    if (mapped.role_color !== undefined) {
      delete mapped.role_color
    }
    if (mapped.has_calendar_access !== undefined) {
      mapped.hasCalendarAccess = mapped.has_calendar_access
      delete mapped.has_calendar_access
    }
    if (mapped.has_event_proposal_access !== undefined) {
      mapped.hasEventProposalAccess = mapped.has_event_proposal_access
      delete mapped.has_event_proposal_access
    }
    if (mapped.has_work_schedule_access !== undefined) {
      mapped.hasWorkScheduleAccess = mapped.has_work_schedule_access
      delete mapped.has_work_schedule_access
    }
    if (mapped.has_work_period_access !== undefined) {
      mapped.hasWorkPeriodAccess = mapped.has_work_period_access
      delete mapped.has_work_period_access
    }
    if (mapped.has_manager_access !== undefined) {
      mapped.hasManagerAccess = mapped.has_manager_access
      delete mapped.has_manager_access
    }
    if (mapped.role_id !== undefined) {
      mapped.roleId = mapped.role_id
      delete mapped.role_id
    }
  }

  if (table === 'tasks') {
    if (mapped.order_index !== undefined) {
      mapped.orderIndex = mapped.order_index
      delete mapped.order_index
    }
    if (mapped.gym_id !== undefined) {
      mapped.gymId = mapped.gym_id
      delete mapped.gym_id
    }
    if (mapped.user_id !== undefined) {
      mapped.userId = mapped.user_id
      delete mapped.user_id
    }
    if (mapped.assigned_to !== undefined) {
      mapped.assignedTo = mapped.assigned_to
      delete mapped.assigned_to
    }
    if (mapped.created_by !== undefined) {
      mapped.createdBy = mapped.created_by
      delete mapped.created_by
    }
    if (mapped.due_date !== undefined) {
      mapped.dueDate = mapped.due_date
      delete mapped.due_date
    }
    if (mapped.sub_period !== undefined) {
      mapped.subPeriod = mapped.sub_period
      delete mapped.sub_period
    }
    if (mapped.role_ids !== undefined) {
      mapped.roleIds = mapped.role_ids
      delete mapped.role_ids
    }
    if (mapped.value !== undefined) {
      delete mapped.value
    }
  }

  if (table === 'gyms') {
    // Mapper location vers address
    if (mapped.location !== undefined) {
      mapped.address = mapped.location
      delete mapped.location
    }
    // Mapper snake_case vers camelCase
    if (mapped.wifi_restricted !== undefined) {
      mapped.wifiRestricted = mapped.wifi_restricted
      delete mapped.wifi_restricted
    }
    if (mapped.wifi_ssid !== undefined) {
      mapped.wifiSsid = mapped.wifi_ssid
      delete mapped.wifi_ssid
    }
    if (mapped.ip_address !== undefined) {
      mapped.ipAddress = mapped.ip_address
      delete mapped.ip_address
    }
    if (mapped.is_active !== undefined) {
      mapped.isActive = mapped.is_active
      delete mapped.is_active
    }
    if (mapped.qr_code_enabled !== undefined) {
      mapped.qrCodeEnabled = mapped.qr_code_enabled
      delete mapped.qr_code_enabled
    }
  }

  if (table === 'work_schedules') {
    if (mapped.work_date !== undefined) {
      mapped.date = mapped.work_date
      delete mapped.work_date
    }
    if (mapped.start_time !== undefined) {
      mapped.startTime = mapped.start_time
      delete mapped.start_time
    }
    if (mapped.end_time !== undefined) {
      mapped.endTime = mapped.end_time
      delete mapped.end_time
    }
    if (mapped.end_date !== undefined) {
      mapped.endDate = mapped.end_date
      delete mapped.end_date
    }
    if (mapped.break_duration !== undefined) {
      mapped.breakDuration = mapped.break_duration
      delete mapped.break_duration
    }
    if (mapped.break_start_time !== undefined) {
      mapped.breakStartTime = mapped.break_start_time
      delete mapped.break_start_time
    }
    if (mapped.employee_email !== undefined) {
      mapped.employeeEmail = mapped.employee_email
      delete mapped.employee_email
    }
    if (mapped.employee_name !== undefined) {
      mapped.employeeName = mapped.employee_name
      delete mapped.employee_name
    }
    if (mapped.user_id !== undefined) {
      mapped.userId = mapped.user_id
      delete mapped.user_id
    }
    if (mapped.gym_id !== undefined) {
      mapped.gymId = mapped.gym_id
      delete mapped.gym_id
    }
    if (mapped.sub_period !== undefined) {
      mapped.subPeriod = mapped.sub_period
      delete mapped.sub_period
    }
    if (mapped.is_temporary !== undefined) {
      mapped.isTemporary = mapped.is_temporary
      delete mapped.is_temporary
    }
    if (mapped.tasks_completed !== undefined) {
      mapped.tasksCompleted = mapped.tasks_completed
      delete mapped.tasks_completed
    }
    if (mapped.total_tasks !== undefined) {
      mapped.totalTasks = mapped.total_tasks
      delete mapped.total_tasks
    }
    // Une date de fin de congé "YYYY-MM-DD" seule fait échouer le parsing DateTime de Prisma.
    if (typeof mapped.endDate === 'string' && mapped.endDate && !mapped.endDate.includes('T')) {
      mapped.endDate = `${mapped.endDate}T00:00:00.000Z`
    }
  }

  return mapped
}

// Mapper les champs du schéma Prisma vers les noms attendus par le client
function mapFieldsToClient(table: string, data: any): any {
  if (!data) return data

  const mapped = { ...data }

  if (table === 'users' || table === 'admins' || table === 'employees') {
    if (mapped.isFirstLogin !== undefined) {
      mapped.is_first_login = mapped.isFirstLogin
      delete mapped.isFirstLogin
    }
    if (mapped.remoteWorkEnabled !== undefined) {
      mapped.remote_work_enabled = mapped.remoteWorkEnabled
      delete mapped.remoteWorkEnabled
    }
    if (mapped.hasCalendarAccess !== undefined) {
      mapped.has_calendar_access = mapped.hasCalendarAccess
      delete mapped.hasCalendarAccess
    }
    if (mapped.hasEventProposalAccess !== undefined) {
      mapped.has_event_proposal_access = mapped.hasEventProposalAccess
      delete mapped.hasEventProposalAccess
    }
    if (mapped.hasWorkScheduleAccess !== undefined) {
      mapped.has_work_schedule_access = mapped.hasWorkScheduleAccess
      delete mapped.hasWorkScheduleAccess
    }
    if (mapped.hasWorkPeriodAccess !== undefined) {
      mapped.has_work_period_access = mapped.hasWorkPeriodAccess
      delete mapped.hasWorkPeriodAccess
    }
    if (mapped.hasManagerAccess !== undefined) {
      mapped.has_manager_access = mapped.hasManagerAccess
      delete mapped.hasManagerAccess
    }
    if (mapped.roleId !== undefined) {
      mapped.role_id = mapped.roleId
      delete mapped.roleId
    }
  }

  if (table === 'tasks') {
    if (mapped.orderIndex !== undefined) {
      mapped.order_index = mapped.orderIndex
      delete mapped.orderIndex
    }
    if (mapped.gymId !== undefined) {
      mapped.gym_id = mapped.gymId
      delete mapped.gymId
    }
    if (mapped.userId !== undefined) {
      mapped.user_id = mapped.userId
      delete mapped.userId
    }
    if (mapped.assignedTo !== undefined) {
      mapped.assigned_to = mapped.assignedTo
      delete mapped.assignedTo
    }
    if (mapped.createdBy !== undefined) {
      mapped.created_by = mapped.createdBy
      delete mapped.createdBy
    }
    if (mapped.dueDate !== undefined) {
      mapped.due_date = mapped.dueDate
      delete mapped.dueDate
    }
    if (mapped.roleIds !== undefined) {
      mapped.role_ids = mapped.roleIds
      delete mapped.roleIds
    }
  }

  if (table === 'gyms') {
    if (mapped.address !== undefined) {
      mapped.location = mapped.address
      delete mapped.address
    }
    if (mapped.wifiRestricted !== undefined) {
      mapped.wifi_restricted = mapped.wifiRestricted
      delete mapped.wifiRestricted
    }
    if (mapped.wifiSsid !== undefined) {
      mapped.wifi_ssid = mapped.wifiSsid
      delete mapped.wifiSsid
    }
    if (mapped.ipAddress !== undefined) {
      mapped.ip_address = mapped.ipAddress
      delete mapped.ipAddress
    }
    if (mapped.isActive !== undefined) {
      mapped.is_active = mapped.isActive
      delete mapped.isActive
    }
    if (mapped.qrCodeEnabled !== undefined) {
      mapped.qr_code_enabled = mapped.qrCodeEnabled
      delete mapped.qrCodeEnabled
    }
  }

  if (table === 'work_schedules') {
    if (mapped.date !== undefined) {
      mapped.work_date = mapped.date
      delete mapped.date
    }
    if (mapped.startTime !== undefined) {
      mapped.start_time = mapped.startTime
      delete mapped.startTime
    }
    if (mapped.endTime !== undefined) {
      mapped.end_time = mapped.endTime
      delete mapped.endTime
    }
    if (mapped.endDate !== undefined) {
      mapped.end_date = mapped.endDate
      delete mapped.endDate
    }
    if (mapped.breakDuration !== undefined) {
      mapped.break_duration = mapped.breakDuration
      delete mapped.breakDuration
    }
    if (mapped.breakStartTime !== undefined) {
      mapped.break_start_time = mapped.breakStartTime
      delete mapped.breakStartTime
    }
    if (mapped.employeeEmail !== undefined) {
      mapped.employee_email = mapped.employeeEmail
      delete mapped.employeeEmail
    }
    if (mapped.employeeName !== undefined) {
      mapped.employee_name = mapped.employeeName
      delete mapped.employeeName
    }
    if (mapped.userId !== undefined) {
      mapped.user_id = mapped.userId
      delete mapped.userId
    }
    if (mapped.gymId !== undefined) {
      mapped.gym_id = mapped.gymId
      delete mapped.gymId
    }
    if (mapped.subPeriod !== undefined) {
      mapped.sub_period = mapped.subPeriod
      delete mapped.subPeriod
    }
    if (mapped.isTemporary !== undefined) {
      mapped.is_temporary = mapped.isTemporary
      delete mapped.isTemporary
    }
    if (mapped.tasksCompleted !== undefined) {
      mapped.tasks_completed = mapped.tasksCompleted
      delete mapped.tasksCompleted
    }
    if (mapped.totalTasks !== undefined) {
      mapped.total_tasks = mapped.totalTasks
      delete mapped.totalTasks
    }
  }

  if (mapped.createdAt !== undefined) {
    mapped.created_at = mapped.createdAt
    delete mapped.createdAt
  }
  if (mapped.updatedAt !== undefined) {
    mapped.updated_at = mapped.updatedAt
    delete mapped.updatedAt
  }

  return mapped
}

interface RouteCheckResult {
  denied?: NextResponse
  managerTier: boolean
}

async function checkTableAccess(
  table: string,
  auth: { userId: string; role: string }
): Promise<RouteCheckResult> {
  if (ADMIN_ONLY_TABLES.has(table) && !isAdminRole(auth.role)) {
    return { denied: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }), managerTier: false }
  }
  if (USER_TABLES.has(table) && !isAdminRole(auth.role)) {
    return { denied: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }), managerTier: false }
  }
  const managerTier = MANAGER_TABLES.has(table) || OWNER_TABLES.has(table)
    ? await isManagerTier(auth.userId, auth.role)
    : false
  if (MANAGER_TABLES.has(table) && !managerTier) {
    return { denied: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }), managerTier }
  }
  return { managerTier }
}

// GET - Récupérer une entrée par ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  const { table, id } = await params
  if (!isKnownTable(table)) {
    return NextResponse.json({ error: 'Table inconnue' }, { status: 400 })
  }
  // Seul cash_movements est sensible en lecture ; user_gyms (l'autre table de MANAGER_TABLES)
  // n'a rien de confidentiel et un employé doit pouvoir le lire (voir checkTableAccess pour l'écriture).
  if (table === 'cash_movements' && !(await isManagerTier(auth.userId, auth.role))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const prismaModel = resolvePrismaModel(table)

    const result = await (prisma as any)[prismaModel].findUnique({
      where: { id },
    })

    if (!result) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }

    // work_schedules : même règle que la liste (GET /api/db/work_schedules) — un employé
    // standard ne peut lire que ses propres lignes ou le planning permanent partagé.
    if (table === 'work_schedules' && result.userId !== auth.userId && result.isTemporary) {
      if (!(await isManagerTier(auth.userId, auth.role))) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    // Mapper les champs de retour
    let mappedResult = mapFieldsToClient(table, result)
    if (USER_TABLES.has(table)) mappedResult = omitPassword(mappedResult)

    return NextResponse.json({ success: true, data: mappedResult })
  } catch (error: any) {
    logger.error('Erreur GET', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération' }, { status: 500 })
  }
}

// PUT - Mettre à jour une entrée
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  const { table, id } = await params
  if (!isKnownTable(table)) {
    return NextResponse.json({ error: 'Table inconnue' }, { status: 400 })
  }
  const access = await checkTableAccess(table, auth)
  if (access.denied) return access.denied

  try {
    const body = await request.json()

    const prismaModel = resolvePrismaModel(table)

    let existingRecord: any = null
    if (OWNER_TABLES.has(table) && !access.managerTier) {
      existingRecord = await (prisma as any)[prismaModel].findUnique({ where: { id } })
      if (!existingRecord) {
        return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
      }
      if (existingRecord.userId !== auth.userId) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    // Mapper les champs du client vers Prisma
    const mappedData = mapFieldsFromClient(table, body)

    // Le passé ne se réécrit pas : une journée déjà terminée est figée, y compris pour un
    // manager ou un admin. Le jour même reste ouvert (comparaison à la journée près).
    // Ne concerne que les champs de planification : marquer un planning comme terminé ou
    // mettre à jour l'avancement des tâches reste possible après coup.
    if (table === 'work_schedules') {
      const PLANNING_FIELDS = [
        'label', 'startTime', 'endTime', 'date', 'endDate',
        'breakDuration', 'breakStartTime', 'gymId', 'employeeEmail', 'employeeName', 'userId',
      ]
      if (PLANNING_FIELDS.some((field) => mappedData[field] !== undefined)) {
        if (!existingRecord) {
          existingRecord = await (prisma as any)[prismaModel].findUnique({ where: { id } })
        }
        // Les périodes temporaires sont les pointages en temps réel (une garde de nuit peut
        // se clôturer après minuit) : elles ne sont pas concernées par ce verrou.
        if (existingRecord && !existingRecord.isTemporary && !isScheduleStillEditable(existingRecord)) {
          return NextResponse.json(
            { error: "Cette journée est passée : le planning n'est plus modifiable." },
            { status: 409 }
          )
        }
      }
    }

    // Un employé ne peut pas transformer un planning en congé (ou étendre un congé) qui
    // chevaucherait un événement planifié auquel il est assigné.
    if (table === 'work_schedules' && !access.managerTier) {
      if (!existingRecord) {
        existingRecord = await (prisma as any)[prismaModel].findUnique({ where: { id } })
      }
      const finalLabel = mappedData.label !== undefined ? mappedData.label : existingRecord?.label
      if (existingRecord && finalLabel === 'conges' && existingRecord.employeeEmail) {
        const rangeStart = new Date(Date.UTC(
          existingRecord.date.getUTCFullYear(), existingRecord.date.getUTCMonth(), existingRecord.date.getUTCDate(), 0, 0, 0, 0
        ))
        const finalEndDateRaw = mappedData.endDate !== undefined ? mappedData.endDate : existingRecord.endDate
        const endDateSource = finalEndDateRaw ? new Date(finalEndDateRaw) : existingRecord.date
        const rangeEnd = new Date(Date.UTC(
          endDateSource.getUTCFullYear(), endDateSource.getUTCMonth(), endDateSource.getUTCDate(), 23, 59, 59, 999
        ))
        const conflict = await findAssignedEventConflict(existingRecord.employeeEmail, rangeStart, rangeEnd)
        if (conflict) {
          return NextResponse.json(
            { error: `Impossible de poser un congé : vous êtes assigné à l'événement "${conflict.title}" le ${conflict.eventDate.toLocaleDateString('fr-FR')}, qui tombe dans cette période.` },
            { status: 409 }
          )
        }
      }
    }

    // Un simple employé/manager ne peut jamais toucher aux champs de permission d'un compte,
    // et seul un superadmin peut attribuer le rôle superadmin.
    if (USER_TABLES.has(table)) {
      if (!isAdminRole(auth.role)) stripFields(mappedData, PROTECTED_USER_FIELDS)
      if (mappedData.role === 'superadmin' && auth.role !== 'superadmin') {
        return NextResponse.json({ error: 'Seul un superadmin peut attribuer ce rôle' }, { status: 403 })
      }
    }
    if (table === 'calendar_events' && !access.managerTier) {
      stripFields(mappedData, PROTECTED_EVENT_FIELDS)
    }

    // Hacher le mot de passe s'il est présent (pour les users)
    if ((table === 'users' || table === 'employees' || table === 'admins') && mappedData.password) {
      mappedData.password = await hashPassword(mappedData.password)
      // Marquer que ce n'est plus la première connexion
      mappedData.isFirstLogin = false
    }

    const result = await (prisma as any)[prismaModel].update({
      where: { id },
      data: mappedData,
    })

    // Mapper les champs de retour
    let mappedResult = mapFieldsToClient(table, result)
    if (USER_TABLES.has(table)) mappedResult = omitPassword(mappedResult)

    return NextResponse.json({ success: true, data: mappedResult })
  } catch (error: any) {
    logger.error('Erreur PUT:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}

// PATCH - Mettre à jour partiellement une entrée (alias de PUT)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  return PUT(request, { params })
}

// DELETE - Supprimer une entrée
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  const { table, id } = await params
  if (!isKnownTable(table)) {
    return NextResponse.json({ error: 'Table inconnue' }, { status: 400 })
  }
  const access = await checkTableAccess(table, auth)
  if (access.denied) return access.denied

  try {
    const prismaModel = resolvePrismaModel(table)

    if (OWNER_TABLES.has(table) && !access.managerTier) {
      const existing = await (prisma as any)[prismaModel].findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
      }
      if (existing.userId !== auth.userId) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    // Pour les utilisateurs, supprimer les enregistrements liés en cascade
    // (les relations sans onDelete: Cascade bloquent sinon la suppression)
    if (table === 'users' || table === 'admins' || table === 'employees') {
      await prisma.$transaction(async (tx) => {
        // Supprimer les plannings
        await tx.workSchedule.deleteMany({ where: { userId: id } })

        // Supprimer les tâches créées par cet utilisateur
        await tx.task.deleteMany({ where: { userId: id } })

        // Supprimer les rappels des événements calendrier de l'utilisateur
        const userCalendarEvents = await tx.calendarEvent.findMany({
          where: { userId: id },
          select: { id: true }
        })
        if (userCalendarEvents.length > 0) {
          await tx.eventReminder.deleteMany({
            where: { eventId: { in: userCalendarEvents.map(e => e.id) } }
          })
        }
        // Supprimer les événements calendrier
        await tx.calendarEvent.deleteMany({ where: { userId: id } })

        // Supprimer les inscriptions de l'utilisateur
        await tx.registration.deleteMany({ where: { userId: id } })

        // Supprimer les sessions et inscriptions liées aux événements créés
        const userEvents = await tx.event.findMany({
          where: { userId: id },
          select: { id: true }
        })
        if (userEvents.length > 0) {
          const eventIds = userEvents.map(e => e.id)
          await tx.session.deleteMany({ where: { eventId: { in: eventIds } } })
          await tx.registration.deleteMany({ where: { eventId: { in: eventIds } } })
        }
        await tx.event.deleteMany({ where: { userId: id } })

        // Supprimer l'utilisateur (UserGym, TimeEntry, PasswordResetToken ont onDelete: Cascade)
        await tx.user.delete({ where: { id } })
      })

      return NextResponse.json({ success: true, message: 'Supprimé avec succès' })
    }

    await (prisma as any)[prismaModel].delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Supprimé avec succès' })
  } catch (error: any) {
    logger.error('Erreur DELETE:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
