import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password-utils'
import { sendWelcomeEmail } from '@/lib/email'
import { getAppBaseUrl } from '@/lib/utils'
import logger from '@/lib/logger'
import { validateTableData } from '@/lib/validation'
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

// Mapper les champs du schéma Prisma vers les noms attendus par le client
function mapFieldsToClient(table: string, data: any): any {
  if (!data) return data

  // Si c'est un tableau, mapper chaque élément
  if (Array.isArray(data)) {
    return data.map(item => mapFieldsToClient(table, item))
  }

  const mapped = { ...data }

  // Mappings spéciaux
  if (table === 'gyms') {
    // Prisma utilise 'address', le client attend 'location'
    if (mapped.address !== undefined) {
      mapped.location = mapped.address
      delete mapped.address
    }
    if (mapped.isActive !== undefined) {
      mapped.is_active = mapped.isActive
      delete mapped.isActive
    }
    // Mapper les champs WiFi de camelCase vers snake_case pour le client
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
    // Mapper qrCodeEnabled de camelCase vers snake_case
    if (mapped.qrCodeEnabled !== undefined) {
      mapped.qr_code_enabled = mapped.qrCodeEnabled
      delete mapped.qrCodeEnabled
    }
  }

  // Mapper active -> is_active pour tous les modèles
  if (mapped.active !== undefined) {
    mapped.is_active = mapped.active
    delete mapped.active
  }

  // Mapper roleIds -> role_ids pour tasks
  if (table === 'tasks' && mapped.roleIds !== undefined) {
    mapped.role_ids = mapped.roleIds
    delete mapped.roleIds
  }

  // Mapper subPeriod -> sub_period pour tasks
  if (table === 'tasks' && mapped.subPeriod !== undefined) {
    mapped.sub_period = mapped.subPeriod
    delete mapped.subPeriod
  }

  // Mapper isFirstLogin -> is_first_login pour users
  if ((table === 'users' || table === 'employees' || table === 'admins') && mapped.isFirstLogin !== undefined) {
    mapped.is_first_login = mapped.isFirstLogin
    delete mapped.isFirstLogin
  }

  // Mapper employeeRole -> employee_role pour users/employees/admins
  if ((table === 'users' || table === 'employees' || table === 'admins') && mapped.employeeRole !== undefined) {
    mapped.employee_role = mapped.employeeRole
    delete mapped.employeeRole
  }

  // Mapper remoteWorkEnabled -> remote_work_enabled pour users
  if ((table === 'users' || table === 'employees' || table === 'admins') && mapped.remoteWorkEnabled !== undefined) {
    mapped.remote_work_enabled = mapped.remoteWorkEnabled
    delete mapped.remoteWorkEnabled
  }

  // Mapper hasCalendarAccess, hasEventProposalAccess, hasWorkScheduleAccess, hasWorkPeriodAccess
  if ((table === 'users' || table === 'employees' || table === 'admins')) {
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
    if (mapped.profilePhoto !== undefined) {
      mapped.profile_photo = mapped.profilePhoto
      delete mapped.profilePhoto
    }
    if (mapped.roleId !== undefined) {
      mapped.role_id = mapped.roleId
      delete mapped.roleId
    }
  }

  // Mapper date -> work_date pour work_schedules
  if (table === 'work_schedules' && mapped.date !== undefined) {
    mapped.work_date = mapped.date
    delete mapped.date
  }

  // Mapper les champs de work_schedules
  if (table === 'work_schedules') {
    if (mapped.endDate !== undefined) {
      mapped.end_date = mapped.endDate
      delete mapped.endDate
    }
    if (mapped.employeeEmail !== undefined) {
      mapped.employee_email = mapped.employeeEmail
      delete mapped.employeeEmail
    }
    if (mapped.employeeName !== undefined) {
      mapped.employee_name = mapped.employeeName
      delete mapped.employeeName
    }
    if (mapped.startTime !== undefined) {
      mapped.start_time = mapped.startTime
      delete mapped.startTime
    }
    if (mapped.endTime !== undefined) {
      mapped.end_time = mapped.endTime
      delete mapped.endTime
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
    if (mapped.breakDuration !== undefined) {
      mapped.break_duration = mapped.breakDuration
      delete mapped.breakDuration
    }
    if (mapped.breakStartTime !== undefined) {
      mapped.break_start_time = mapped.breakStartTime
      delete mapped.breakStartTime
    }
  }

  // Mapper les champs de user_gyms
  if (table === 'user_gyms') {
    if (mapped.userId !== undefined) {
      mapped.user_id = mapped.userId
      delete mapped.userId
    }
    if (mapped.gymId !== undefined) {
      mapped.gym_id = mapped.gymId
      delete mapped.gymId
    }
  }

  // Mapper les champs de calendar_events
  if (table === 'calendar_events') {
    if (mapped.eventDate !== undefined) {
      mapped.event_date = mapped.eventDate
      delete mapped.eventDate
    }
    if (mapped.eventEndDate !== undefined) {
      mapped.event_end_date = mapped.eventEndDate
      delete mapped.eventEndDate
    }
    if (mapped.eventTime !== undefined) {
      mapped.event_time = mapped.eventTime
      delete mapped.eventTime
    }
    if (mapped.durationMinutes !== undefined) {
      mapped.duration_minutes = mapped.durationMinutes
      delete mapped.durationMinutes
    }
    if (mapped.createdByEmail !== undefined) {
      mapped.created_by_email = mapped.createdByEmail
      delete mapped.createdByEmail
    }
    if (mapped.createdByName !== undefined) {
      mapped.created_by_name = mapped.createdByName
      delete mapped.createdByName
    }
    if (mapped.rejectionReason !== undefined) {
      mapped.rejection_reason = mapped.rejectionReason
      delete mapped.rejectionReason
    }
    if (mapped.approvedBy !== undefined) {
      mapped.approved_by = mapped.approvedBy
      delete mapped.approvedBy
    }
    if (mapped.approvedAt !== undefined) {
      mapped.approved_at = mapped.approvedAt
      delete mapped.approvedAt
    }
    if (mapped.userId !== undefined) {
      mapped.user_id = mapped.userId
      delete mapped.userId
    }
  }

  // Mapper createdAt -> created_at et updatedAt -> updated_at
  if (mapped.createdAt !== undefined) {
    mapped.created_at = mapped.createdAt
    delete mapped.createdAt
  }
  if (mapped.updatedAt !== undefined) {
    mapped.updated_at = mapped.updatedAt
    delete mapped.updatedAt
  }

  // Mapper les champs de custom_pages
  if (table === 'custom_pages') {
    if (mapped.orderIndex !== undefined) {
      mapped.order_index = mapped.orderIndex
      delete mapped.orderIndex
    }
    if (mapped.isActive !== undefined) {
      mapped.is_active = mapped.isActive
      delete mapped.isActive
    }
    if (mapped.roleIds !== undefined) {
      mapped.role_ids = mapped.roleIds
      delete mapped.roleIds
    }
    if (mapped.createdBy !== undefined) {
      mapped.created_by = mapped.createdBy
      delete mapped.createdBy
    }
  }

  // Mapper les champs de custom_page_items
  if (table === 'custom_page_items') {
    if (mapped.pageId !== undefined) {
      mapped.page_id = mapped.pageId
      delete mapped.pageId
    }
    if (mapped.orderIndex !== undefined) {
      mapped.order_index = mapped.orderIndex
      delete mapped.orderIndex
    }
    if (mapped.isActive !== undefined) {
      mapped.is_active = mapped.isActive
      delete mapped.isActive
    }
  }

  // Pour les users qui sont des admins/employees, mapper le role vers is_super_admin
  if ((table === 'admins' || table === 'employees') && mapped.role !== undefined) {
    mapped.is_super_admin = mapped.role === 'superadmin'
  }

  return mapped
}

// GET - Lire des données
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  const { table } = await params
  if (!isKnownTable(table)) {
    return NextResponse.json({ data: null, error: { message: 'Table inconnue' } }, { status: 400 })
  }

  // cash_movements est une donnée financière — réservée aux managers/admins, y compris en lecture.
  // user_gyms est dans MANAGER_TABLES pour l'écriture (assigner un employé à une salle est une
  // action de gestion), mais la lecture (qui travaille dans quelle salle) n'est pas sensible et
  // est nécessaire à tout employé pour afficher son propre planning et la légende de ses collègues.
  if (table === 'cash_movements' && !(await isManagerTier(auth.userId, auth.role))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const isSingle = searchParams.get('single') === 'true'

    const prismaModel = resolvePrismaModel(table)

    // Convertir snake_case vers camelCase pour les noms de colonnes
    const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

    // Construire les filtres
    const where: any = {}
    searchParams.forEach((value, key) => {
      if (key !== 'single' && key !== 'orderBy' && key !== 'orderDir') {
        if (key.endsWith('_gte')) {
          let field = snakeToCamel(key.replace('_gte', ''))
          // Mappings spéciaux
          if (field === 'workDate') field = 'date'
          if (field === 'eventDate') field = 'eventDate'
          // Convertir les dates simples en ISO-8601 avec heure
          let filterValue = value
          if (field === 'date' || field === 'eventDate' || field === 'eventEndDate' || field === 'endDate') {
            filterValue = value.includes('T') ? value : `${value}T00:00:00.000Z`
          }
          const currentRange = (typeof where[field] === 'object' && where[field] !== null) ? where[field] : {}
          where[field] = { ...currentRange, gte: filterValue }
        } else if (key.endsWith('_lte')) {
          let field = snakeToCamel(key.replace('_lte', ''))
          // Mappings spéciaux
          if (field === 'workDate') field = 'date'
          if (field === 'eventDate') field = 'eventDate'
          // Convertir les dates simples en ISO-8601 avec heure
          let filterValue = value
          if (field === 'date' || field === 'eventDate' || field === 'eventEndDate' || field === 'endDate') {
            filterValue = value.includes('T') ? value : `${value}T23:59:59.999Z`
          }
          const currentRange = (typeof where[field] === 'object' && where[field] !== null) ? where[field] : {}
          where[field] = { ...currentRange, lte: filterValue }
        } else if (key.endsWith('_neq')) {
          let field = snakeToCamel(key.replace('_neq', ''))
          where[field] = { not: value }
        } else {
          let field = snakeToCamel(key)
          // Mappings spéciaux
          // Pour users/employees/admins: is_active → active
          // Pour autres tables (gyms, etc): is_active → isActive
          if (field === 'isActive' && (table === 'employees' || table === 'admins' || table === 'users')) {
            field = 'active'
          }
          if (field === 'workDate' && table === 'work_schedules') field = 'date'
          if (field === 'eventDate' && table === 'calendar_events') field = 'eventDate'
          if (field === 'gymId') field = 'gymId'
          if (field === 'userId') field = 'userId'
          // Convertir les booléens
          if (value === 'true') {
            where[field] = true
          } else if (value === 'false') {
            where[field] = false
          } else {
            // Convertir les dates simples en ISO-8601 avec heure pour les champs date
            if ((field === 'date' || field === 'eventDate') && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
              where[field] = new Date(value + 'T00:00:00.000Z')
            } else {
              where[field] = value
            }
          }
        }
      }
    })

    // Ajouter un filtre sur le rôle pour les tables admins et employees
    if (table === 'employees') {
      where.role = 'employee'
    } else if (table === 'admins') {
      where.role = { in: ['admin', 'superadmin'] }
    }

    // work_schedules : un employé standard ne doit voir que ses propres lignes (congés/périodes
    // ponctuelles) + le planning permanent partagé — jamais les congés/notes personnelles des
    // autres employés. C'était appliqué par l'ancienne route dédiée (supprimée) ; ce handler
    // générique ne le faisait pas, ce qui exposait les congés de tout le monde à n'importe quel
    // employé connecté.
    if (table === 'work_schedules' && !(await isManagerTier(auth.userId, auth.role))) {
      where.OR = [{ userId: auth.userId }, { isTemporary: false }]
    }

    // Construire l'orderBy
    const orderByColumn = searchParams.get('orderBy')
    const orderByDir = searchParams.get('orderDir')
    let orderBy
    if (orderByColumn) {
      let field = snakeToCamel(orderByColumn)
      // Mappings spéciaux pour orderBy
      if (field === 'workDate') field = 'date'
      if (field === 'eventDate') field = 'eventDate'
      orderBy = { [field]: orderByDir || 'asc' }
    }

    // Préparer l'include pour les relations
    const include: any = {}
    if (table === 'employees' || table === 'admins' || table === 'users') {
      include.employeeRole = true
    }

    // Exécuter la requête
    if (isSingle) {
      const data = await (prisma as any)[prismaModel].findFirst({
        where,
        orderBy,
        include: Object.keys(include).length > 0 ? include : undefined
      })

      // Mapper les champs du schéma vers les noms attendus par le client
      let mappedData = data ? mapFieldsToClient(table, data) : null
      if (USER_TABLES.has(table)) mappedData = omitPassword(mappedData)

      return NextResponse.json({
        data: mappedData,
        error: !data ? { code: 'PGRST116' } : null
      })
    } else {
      const data = await (prisma as any)[prismaModel].findMany({
        where,
        orderBy,
        include: Object.keys(include).length > 0 ? include : undefined
      })

      // Mapper les champs du schéma vers les noms attendus par le client (gère automatiquement les tableaux)
      let mappedData = mapFieldsToClient(table, data)
      if (USER_TABLES.has(table)) mappedData = omitPassword(mappedData)

      return NextResponse.json({ data: mappedData || [], error: null })
    }
  } catch (error: any) {
    logger.error('Erreur GET', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors de la récupération des données' } },
      { status: 500 }
    )
  }
}

// POST - Créer des données
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }
  const authUserId = auth.userId

  const { table } = await params
  if (!isKnownTable(table)) {
    return NextResponse.json({ data: null, error: { message: 'Table inconnue' } }, { status: 400 })
  }

  if (ADMIN_ONLY_TABLES.has(table) && !isAdminRole(auth.role)) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }
  if (USER_TABLES.has(table) && !isAdminRole(auth.role)) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }
  const managerTier = MANAGER_TABLES.has(table) || OWNER_TABLES.has(table)
    ? await isManagerTier(auth.userId, auth.role)
    : false
  if (MANAGER_TABLES.has(table) && !managerTier) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }

  try {
    const { data } = await request.json()
    const prismaModel = resolvePrismaModel(table)

    if (!data) {
      return NextResponse.json(
        { data: null, error: { message: 'Aucune donnée fournie' } },
        { status: 400 }
      )
    }

    const items = Array.isArray(data) ? data : [data]

    // Valider et sanitizer les données
    for (const item of items) {
      const validation = validateTableData(table, item)
      if (!validation.valid) {
        return NextResponse.json(
          { data: null, error: { message: `Validation échouée: ${validation.errors.join(', ')}` } },
          { status: 400 }
        )
      }
    }

    // Note : pas d'échappement HTML ici. React échappe déjà à l'affichage, donc échapper
    // aussi au stockage double-échappait le texte (cassait les apostrophes françaises et les
    // exports Excel/PDF, qui affichaient littéralement "&#x27;" au lieu de "'"). Prisma
    // paramètre toutes les requêtes, donc aucun risque d'injection SQL à stocker le texte brut.

    // Un employé ne peut pas poser un congé qui chevauche un événement planifié auquel il est
    // assigné (par email ou par son rôle). Un manager/admin peut outrepasser cette règle.
    if (table === 'work_schedules' && !managerTier) {
      for (const item of items) {
        if (item.label !== 'conges' || !item.employee_email || !item.work_date) continue
        const rangeStart = new Date(`${String(item.work_date).split('T')[0]}T00:00:00.000Z`)
        const rangeEnd = new Date(`${String(item.end_date || item.work_date).split('T')[0]}T23:59:59.999Z`)
        const conflict = await findAssignedEventConflict(item.employee_email, rangeStart, rangeEnd)
        if (conflict) {
          return NextResponse.json(
            {
              data: null,
              error: {
                message: `Impossible de poser un congé : vous êtes assigné à l'événement "${conflict.title}" le ${conflict.eventDate.toLocaleDateString('fr-FR')}, qui tombe dans cette période.`,
              },
            },
            { status: 409 }
          )
        }
      }
    }

    // Convertir snake_case vers camelCase
    const convertedItems = await Promise.all(items.map(async (item: any) => {
      const converted: any = {}
      for (const [key, value] of Object.entries(item)) {
        let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

        // Mappings spéciaux pour correspondre au schéma Prisma
        if (camelKey === 'location' && table === 'gyms') {
          camelKey = 'address' // gyms utilise 'address' dans le schéma
        }

        // Mapper work_date -> date pour work_schedules (le schéma Prisma utilise 'date')
        if (table === 'work_schedules' && camelKey === 'workDate') {
          camelKey = 'date'
        }

        // Mapper role_ids -> roleIds pour tasks
        if (table === 'tasks' && camelKey === 'roleIds') {
          camelKey = 'roleIds'
        }

        // Mapper sub_period -> subPeriod pour tasks
        if (table === 'tasks' && camelKey === 'subPeriod') {
          camelKey = 'subPeriod'
        }

        // Mapper les champs WiFi de snake_case vers camelCase pour Prisma
        if (table === 'gyms') {
          if (camelKey === 'wifiRestricted') camelKey = 'wifiRestricted'
          if (camelKey === 'wifiSsid') camelKey = 'wifiSsid'
          if (camelKey === 'ipAddress') camelKey = 'ipAddress'
          if (camelKey === 'qrCodeEnabled') camelKey = 'qrCodeEnabled'
        }

        // Mapper is_active -> active pour users (employees/admins), mais isActive pour gyms et autres tables
        if (camelKey === 'isActive') {
          if (table === 'users' || table === 'employees' || table === 'admins') {
            camelKey = 'active'
          } else {
            camelKey = 'isActive' // gyms, allowed_networks, etc.
          }
        }

        // Mapper work_date -> date pour work_schedules
        if (camelKey === 'workDate' && table === 'work_schedules') {
          camelKey = 'date'
        }

        // Mapper event_date -> eventDate pour calendar_events
        if (camelKey === 'eventDate' && table === 'calendar_events') {
          camelKey = 'eventDate'
        }

        // Ignorer les champs qui n'existent pas dans le schéma
        if (camelKey === 'description' && table === 'gyms') {
          continue // gyms n'a pas de champ description
        }
        if (table === 'tasks' && camelKey === 'value') {
          continue // le schéma tasks ne contient pas de colonne value
        }
        if (camelKey === 'isSuperAdmin') {
          continue // géré via role
        }
        // Ignorer employeeRole et roleColor car ils sont gérés via la relation roleId
        if ((table === 'users' || table === 'employees' || table === 'admins') &&
            (camelKey === 'employeeRole' || camelKey === 'roleColor')) {
          continue
        }

        converted[camelKey] = value
      }

      // Assigner le bon rôle selon la table
      if (table === 'employees') {
        converted.role = 'employee'
      } else if (table === 'admins') {
        // Si is_super_admin est défini, utiliser 'superadmin', sinon 'admin'
        converted.role = item.is_super_admin ? 'superadmin' : 'admin'
      }

      // Seul un superadmin peut créer un compte superadmin (empêche un admin de s'auto-élever
      // en créant/promouvant un compte superadmin via cette route).
      if (USER_TABLES.has(table) && converted.role === 'superadmin' && auth.role !== 'superadmin') {
        throw new Error('FORBIDDEN_SUPERADMIN')
      }

      // Convertir les dates simples en DateTime ISO-8601 pour calendar_events
      if (table === 'calendar_events' && converted.eventDate) {
        // Si la date ne contient pas d'heure, ajouter T00:00:00.000Z
        if (typeof converted.eventDate === 'string' && !converted.eventDate.includes('T')) {
          converted.eventDate = `${converted.eventDate}T00:00:00.000Z`
        }
      }
      if (table === 'calendar_events' && converted.eventEndDate) {
        if (typeof converted.eventEndDate === 'string' && !converted.eventEndDate.includes('T')) {
          converted.eventEndDate = `${converted.eventEndDate}T00:00:00.000Z`
        }
      }

      // Convertir les dates simples en DateTime ISO-8601 pour work_schedules
      if (table === 'work_schedules' && converted.date) {
        if (typeof converted.date === 'string' && !converted.date.includes('T')) {
          converted.date = new Date(`${converted.date}T00:00:00.000Z`)
        } else if (typeof converted.date === 'string') {
          converted.date = new Date(converted.date)
        }
      }
      // Idem pour la date de fin des congés (endDate) : une chaîne "YYYY-MM-DD" seule
      // fait échouer le parsing DateTime de Prisma, d'où le 500 lors de la prise de congés.
      if (table === 'work_schedules' && converted.endDate) {
        if (typeof converted.endDate === 'string' && !converted.endDate.includes('T')) {
          converted.endDate = new Date(`${converted.endDate}T00:00:00.000Z`)
        } else if (typeof converted.endDate === 'string') {
          converted.endDate = new Date(converted.endDate)
        }
      }

      // Ajouter userId si nécessaire
      if (!converted.userId && table === 'calendar_events') {
        const user = await prisma.user.findUnique({ where: { email: converted.createdByEmail } })
        if (user) converted.userId = user.id
        else {
          // Utiliser le premier admin si l'email n'est pas trouvé
          const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
          if (admin) converted.userId = admin.id
        }
      }
      if (!converted.userId && table === 'work_schedules') {
        // Pour work_schedules, utiliser l'email de l'employé
        if (converted.employeeEmail) {
          const user = await prisma.user.findUnique({ where: { email: converted.employeeEmail } })
          if (user) {
            converted.userId = user.id
          } else {
            const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
            if (admin) converted.userId = admin.id
          }
        } else {
          const user = await prisma.user.findFirst({ where: { role: 'admin' } })
          if (user) converted.userId = user.id
        }
      }
      if (!converted.userId && table === 'tasks') {
        // Priorité: utilisateur authentifié, fallback admin si nécessaire
        converted.userId = authUserId
        if (!converted.userId) {
          const user = await prisma.user.findFirst({ where: { role: 'admin' } })
          if (user) converted.userId = user.id
        }
      }

      // createdBy est obligatoire dans le schéma tasks
      if (table === 'tasks' && !converted.createdBy) {
        converted.createdBy = authUserId
      }


      // Nettoyer createdBy s'il est vide
      if (converted.createdBy === '') {
        delete converted.createdBy
      }

      // Un employé standard (pas manager/admin) ne peut créer des lignes que pour lui-même,
      // et ne peut jamais s'auto-approuver un événement calendrier.
      if (OWNER_TABLES.has(table) && !managerTier) {
        converted.userId = authUserId
        if (table === 'calendar_events') {
          stripFields(converted, PROTECTED_EVENT_FIELDS)
        }
      }

      return converted
    }))

    // Insérer dans Prisma
    const results = []
    for (const item of convertedItems) {
      // Pour les tables avec relations obligatoires (tasks, work_schedules),
      // convertir userId en relation connect
      const data = { ...item }

      if ((table === 'tasks' || table === 'work_schedules') && data.userId) {
        const userId = data.userId
        delete data.userId
        data.user = { connect: { id: userId } }
      }

      // De même pour gymId dans tasks et work_schedules. La clé doit être retirée même
      // quand elle est null/undefined (ex: congés sans salle) : sa présence combinée à
      // `user: { connect }` force Prisma à utiliser le type "checked" (relations uniquement),
      // qui n'accepte pas la clé étrangère brute `gymId` et fait échouer la création (500).
      if (table === 'tasks' || table === 'work_schedules') {
        const gymId = data.gymId
        delete data.gymId
        if (gymId) {
          data.gym = { connect: { id: gymId } }
        }
      }

      // Nettoyer createdBy s'il est vide (doit être fait après la copie de convertedItems)
      if (data.createdBy === '') {
        delete data.createdBy
      }

      // Hacher le mot de passe pour les utilisateurs
      if ((table === 'users' || table === 'employees' || table === 'admins') && data.password) {
        data.password = await hashPassword(data.password)
      }

      try {
        const result = await (prisma as any)[prismaModel].create({ data })
        results.push(result)

        // Un compte créé sans mot de passe attend une première connexion : on envoie un lien
        // d'activation à usage unique plutôt que de laisser quiconque connaît l'email
        // s'approprier le compte via /api/auth/first-login.
        if (USER_TABLES.has(table) && result.isFirstLogin && !result.password) {
          const activationToken = randomBytes(32).toString('hex')
          await prisma.passwordResetToken.create({
            data: {
              token: activationToken,
              userId: result.id,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          })
          const activationUrl = `${getAppBaseUrl()}/first-login?email=${encodeURIComponent(result.email)}&token=${activationToken}`
          sendWelcomeEmail(result.email, activationUrl).catch((emailError) => {
            logger.error('Échec envoi email de bienvenue', emailError)
          })
        }
      } catch (createError: any) {
        logger.error(`Échec de la création dans ${table}`, createError)
        if (createError.code === 'P2002') {
          return NextResponse.json(
            { data: null, error: { message: 'Un utilisateur avec cet email existe déjà.' } },
            { status: 409 }
          )
        }
        throw new Error(`Échec de la création: ${createError.message || 'Erreur inconnue'}`)
      }
    }

    return NextResponse.json({ data: omitPassword(results), error: null })
  } catch (error: any) {
    if (error.message === 'FORBIDDEN_SUPERADMIN') {
      return NextResponse.json({ data: null, error: { message: 'Seul un superadmin peut attribuer ce rôle' } }, { status: 403 })
    }
    logger.error('Erreur POST', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Erreur lors de la création' } },
      { status: 500 }
    )
  }
}

// PUT - Mettre à jour des données
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  const { table } = await params
  if (!isKnownTable(table)) {
    return NextResponse.json({ data: null, error: { message: 'Table inconnue' } }, { status: 400 })
  }

  if (ADMIN_ONLY_TABLES.has(table) && !isAdminRole(auth.role)) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }
  if (USER_TABLES.has(table) && !isAdminRole(auth.role)) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }
  const managerTier = MANAGER_TABLES.has(table) || OWNER_TABLES.has(table)
    ? await isManagerTier(auth.userId, auth.role)
    : false
  if (MANAGER_TABLES.has(table) && !managerTier) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }

  try {
    const { data, where } = await request.json()
    const prismaModel = resolvePrismaModel(table)

    // Le client (lib/api-client.ts) n'envoie jamais qu'une seule clé de filtre (`.eq(column, value)`).
    // On refuse toute clause `where` plus large pour empêcher une mise à jour en masse arbitraire.
    if (!where || typeof where !== 'object' || Array.isArray(where) || Object.keys(where).length !== 1) {
      return NextResponse.json(
        { data: null, error: { message: 'Clause de filtre invalide : une seule condition est autorisée' } },
        { status: 400 }
      )
    }
    const [whereField, whereValue] = Object.entries(where)[0]

    // Pour les tables à propriétaire, un employé standard ne peut modifier que sa propre ligne.
    if (OWNER_TABLES.has(table) && !managerTier) {
      if (whereField !== 'id') {
        return NextResponse.json({ data: null, error: { message: 'Filtre non autorisé' } }, { status: 400 })
      }
      const existing = await (prisma as any)[prismaModel].findUnique({ where: { id: whereValue } })
      if (!existing) {
        return NextResponse.json({ data: null, error: { message: 'Introuvable' } }, { status: 404 })
      }
      if (existing.userId !== auth.userId) {
        return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
      }
    }

    // Valider les données
    const validation = validateTableData(table, data)
    if (!validation.valid) {
      return NextResponse.json(
        { data: null, error: { message: `Validation échouée: ${validation.errors.join(', ')}` } },
        { status: 400 }
      )
    }

    // Convertir snake_case vers camelCase
    const converted: any = {}
    for (const [key, value] of Object.entries(data)) {
      let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

      // Mapper location → address pour les gyms
      if (camelKey === 'location' && table === 'gyms') {
        camelKey = 'address'
      }

      // Mapper les champs WiFi et QR pour les gyms
      if (table === 'gyms') {
        if (camelKey === 'wifiRestricted') camelKey = 'wifiRestricted'
        if (camelKey === 'wifiSsid') camelKey = 'wifiSsid'
        if (camelKey === 'ipAddress') camelKey = 'ipAddress'
        if (camelKey === 'qrCodeEnabled') camelKey = 'qrCodeEnabled'
      }

      // Mapper is_active → isActive pour new_member_instruction_items, ou → active pour users
      if (camelKey === 'isActive' && table !== 'new_member_instruction_items' && table !== 'app_config' && table !== 'gyms') {
        camelKey = 'active'
      }

      // Mapper work_date → date pour work_schedules
      if (camelKey === 'workDate' && table === 'work_schedules') {
        camelKey = 'date'
      }

      // Mapper event_date → eventDate pour calendar_events
      if (camelKey === 'eventDate' && table === 'calendar_events') {
        camelKey = 'eventDate'
      }

      // Ignorer les champs qui n'existent pas dans le schéma
      if (camelKey === 'description' && table === 'gyms') {
        continue // gyms n'a pas de champ description
      }
      if (table === 'tasks' && camelKey === 'value') {
        continue // le schéma tasks ne contient pas de colonne value
      }
      if (camelKey === 'isSuperAdmin') {
        continue // géré via role
      }

      converted[camelKey] = value
    }

    // Convertir les dates simples en DateTime ISO-8601 pour calendar_events
    if (table === 'calendar_events') {
      if (typeof converted.eventDate === 'string' && !converted.eventDate.includes('T')) {
        converted.eventDate = `${converted.eventDate}T00:00:00.000Z`
      }
      if (typeof converted.eventEndDate === 'string' && !converted.eventEndDate.includes('T')) {
        converted.eventEndDate = `${converted.eventEndDate}T00:00:00.000Z`
      }
    }

    // Ne pas permettre de changer le rôle via cette API pour employees/admins
    // Le rôle est fixe selon la table
    if (table === 'employees' || table === 'admins') {
      delete converted.role
    }
    // Seul un superadmin peut promouvoir un compte superadmin
    if (USER_TABLES.has(table) && converted.role === 'superadmin' && auth.role !== 'superadmin') {
      return NextResponse.json({ data: null, error: { message: 'Seul un superadmin peut attribuer ce rôle' } }, { status: 403 })
    }
    // Un employé standard ne peut jamais modifier le workflow d'approbation d'un événement
    if (table === 'calendar_events' && !managerTier) {
      stripFields(converted, PROTECTED_EVENT_FIELDS)
    }

    const result = await (prisma as any)[prismaModel].updateMany({
      where,
      data: converted,
    })

    return NextResponse.json({ data: result, error: null })
  } catch (error: any) {
    logger.error('Erreur PUT', error)
    return NextResponse.json(
      { data: null, error: { message: 'Erreur lors de la mise à jour' } },
      { status: 500 }
    )
  }
}

// PATCH - Mettre à jour un seul enregistrement par ID ou email
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  const { table } = await params
  if (!isKnownTable(table)) {
    return NextResponse.json({ data: null, error: { message: 'Table inconnue' } }, { status: 400 })
  }

  if (ADMIN_ONLY_TABLES.has(table) && !isAdminRole(auth.role)) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }
  if (USER_TABLES.has(table) && !isAdminRole(auth.role)) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }
  const managerTier = MANAGER_TABLES.has(table) || OWNER_TABLES.has(table)
    ? await isManagerTier(auth.userId, auth.role)
    : false
  if (MANAGER_TABLES.has(table) && !managerTier) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    const body = await request.json()
    const prismaModel = resolvePrismaModel(table)

    // Accepter email dans le body pour les users
    const email = body.email

    if (!id && !email) {
      return NextResponse.json(
        { data: null, error: { message: 'ID ou email manquant' } },
        { status: 400 }
      )
    }

    // Construire le where selon ce qui est fourni.
    // id peut être un cuid (string) ou un entier : ne convertir que si purement numérique.
    const where: any = id ? { id: /^\d+$/.test(id) ? parseInt(id, 10) : id } : { email }

    if (OWNER_TABLES.has(table) && !managerTier) {
      if (!id) {
        return NextResponse.json({ data: null, error: { message: 'Filtre non autorisé' } }, { status: 400 })
      }
      const existing = await (prisma as any)[prismaModel].findUnique({ where })
      if (!existing) {
        return NextResponse.json({ data: null, error: { message: 'Introuvable' } }, { status: 404 })
      }
      if (existing.userId !== auth.userId) {
        return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
      }
    }

    // Convertir snake_case vers camelCase
    const converted: any = {}
    for (const [key, value] of Object.entries(body)) {
      // Ignorer l'email dans les données à updater
      if (key === 'email') continue

      let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

      // Mapper location → address pour les gyms
      if (camelKey === 'location' && table === 'gyms') {
        camelKey = 'address'
      }

      // Mapper les champs WiFi et QR pour les gyms
      if (table === 'gyms') {
        if (camelKey === 'wifiRestricted') camelKey = 'wifiRestricted'
        if (camelKey === 'wifiSsid') camelKey = 'wifiSsid'
        if (camelKey === 'ipAddress') camelKey = 'ipAddress'
        if (camelKey === 'qrCodeEnabled') camelKey = 'qrCodeEnabled'
      }

      // Mapper is_active → isActive pour new_member_instruction_items, ou → active pour users
      if (camelKey === 'isActive' && table !== 'new_member_instruction_items' && table !== 'app_config' && table !== 'gyms') {
        camelKey = 'active'
      }

      // Mapper work_date → date pour work_schedules
      if (camelKey === 'workDate' && table === 'work_schedules') {
        camelKey = 'date'
      }

      // Mapper event_date → eventDate pour calendar_events
      if (camelKey === 'eventDate' && table === 'calendar_events') {
        camelKey = 'eventDate'
      }

      // Ignorer les champs qui n'existent pas dans le schéma
      if (camelKey === 'description' && table === 'gyms') {
        continue
      }
      if (table === 'tasks' && camelKey === 'value') {
        continue // le schéma tasks ne contient pas de colonne value
      }
      if (camelKey === 'isSuperAdmin') {
        continue
      }

      converted[camelKey] = value
    }

    // Convertir les dates simples en DateTime ISO-8601 pour calendar_events
    if (table === 'calendar_events') {
      if (typeof converted.eventDate === 'string' && !converted.eventDate.includes('T')) {
        converted.eventDate = `${converted.eventDate}T00:00:00.000Z`
      }
      if (typeof converted.eventEndDate === 'string' && !converted.eventEndDate.includes('T')) {
        converted.eventEndDate = `${converted.eventEndDate}T00:00:00.000Z`
      }
    }

    // Un simple employé/manager ne peut jamais toucher aux champs de permission d'un compte,
    // et seul un superadmin peut attribuer le rôle superadmin.
    if (USER_TABLES.has(table)) {
      if (!isAdminRole(auth.role)) stripFields(converted, PROTECTED_USER_FIELDS)
      if (converted.role === 'superadmin' && auth.role !== 'superadmin') {
        return NextResponse.json({ data: null, error: { message: 'Seul un superadmin peut attribuer ce rôle' } }, { status: 403 })
      }
    }
    if (table === 'calendar_events' && !managerTier) {
      stripFields(converted, PROTECTED_EVENT_FIELDS)
    }

    // Hacher le mot de passe s'il est présent (pour les users)
    if ((table === 'users' || table === 'employees' || table === 'admins') && converted.password) {
      converted.password = await hashPassword(converted.password)
      // Marquer que ce n'est plus la première connexion
      converted.isFirstLogin = false
    }

    const result = await (prisma as any)[prismaModel].update({
      where,
      data: converted,
    })

    // Mapper les champs de retour
    let mappedResult = mapFieldsToClient(table, result)
    if (USER_TABLES.has(table)) mappedResult = omitPassword(mappedResult)

    return NextResponse.json({ data: mappedResult, error: null })
  } catch (error: any) {
    logger.error('Erreur PATCH', error)
    return NextResponse.json(
      { data: null, error: { message: 'Erreur lors de la mise à jour' } },
      { status: 500 }
    )
  }
}

// DELETE - Supprimer des données
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await verifyAuthWithRole(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    )
  }

  const { table } = await params
  if (!isKnownTable(table)) {
    return NextResponse.json({ data: null, error: { message: 'Table inconnue' } }, { status: 400 })
  }

  if (ADMIN_ONLY_TABLES.has(table) && !isAdminRole(auth.role)) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }
  if (USER_TABLES.has(table) && !isAdminRole(auth.role)) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }
  const managerTier = MANAGER_TABLES.has(table) || OWNER_TABLES.has(table)
    ? await isManagerTier(auth.userId, auth.role)
    : false
  if (MANAGER_TABLES.has(table) && !managerTier) {
    return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    const prismaModel = resolvePrismaModel(table)

    if (!id) {
      return NextResponse.json(
        { data: null, error: { message: 'ID requis pour la suppression' } },
        { status: 400 }
      )
    }

    // Supprimer l'enregistrement par ID.
    // La plupart des modèles utilisent un id string (cuid) ; seuls quelques-uns
    // utilisent un entier auto-incrémenté. On ne convertit en entier que si l'id
    // est purement numérique, sinon parseInt() casserait les ids cuid (NaN).
    const idValue: string | number = /^\d+$/.test(id) ? parseInt(id, 10) : id

    if (OWNER_TABLES.has(table) && !managerTier) {
      const existing = await (prisma as any)[prismaModel].findUnique({ where: { id: idValue } })
      if (!existing) {
        return NextResponse.json({ data: null, error: { message: 'Introuvable' } }, { status: 404 })
      }
      if (existing.userId !== auth.userId) {
        return NextResponse.json({ data: null, error: { message: 'Accès refusé' } }, { status: 403 })
      }
    }

    const result = await (prisma as any)[prismaModel].delete({
      where: { id: idValue }
    })

    return NextResponse.json({ data: result, error: null })
  } catch (error: any) {
    logger.error('Erreur DELETE', error)
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    )
  }
}
