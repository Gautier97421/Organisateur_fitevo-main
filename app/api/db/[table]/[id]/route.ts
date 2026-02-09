import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Mapping des tables
const tableMapping: { [key: string]: string } = {
  calendar_events: 'calendarEvent',
  event_reminders: 'eventReminder',
  gyms: 'gym',
  tasks: 'task',
  work_schedules: 'workSchedule',
  allowed_networks: 'allowedNetwork',
  users: 'user',
  admins: 'user',
  employees: 'user',
  new_member_instruction_items: 'newMemberInstructionItem',
  app_config: 'appConfig',
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

// GET - Récupérer une entrée par ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const { table, id } = await params
  try {
    const prismaModel = tableMapping[table] || table
    
    // @ts-ignore - Accès dynamique au modèle Prisma
    const result = await prisma[prismaModel].findUnique({
      where: { id },
    })
    
    if (!result) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }
    
    // Mapper les champs de retour
    const mappedResult = mapFieldsToClient(table, result)
    
    return NextResponse.json({ success: true, data: mappedResult })
  } catch (error: any) {
    console.error('Erreur GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Mettre à jour une entrée
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const { table, id } = await params
  try {
    const body = await request.json()
    
    const prismaModel = tableMapping[table] || table
    
    // Mapper les champs du client vers Prisma
    const mappedData = mapFieldsFromClient(table, body)
    
    // @ts-ignore - Accès dynamique au modèle Prisma
    const result = await prisma[prismaModel].update({
      where: { id },
      data: mappedData,
    })
    
    // Mapper les champs de retour
    const mappedResult = mapFieldsToClient(table, result)
    
    return NextResponse.json({ success: true, data: mappedResult })
  } catch (error: any) {
    console.error('Erreur PUT:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Mettre à jour partiellement une entrée (alias de PUT)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  return PUT(request, { params })
}

// DELETE - Supprimer une entrée
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const { table, id } = await params
  try {
    const prismaModel = tableMapping[table] || table
    
    // @ts-ignore - Accès dynamique au modèle Prisma
    await prisma[prismaModel].delete({
      where: { id },
    })
    
    return NextResponse.json({ success: true, message: 'Supprimé avec succès' })
  } catch (error: any) {
    console.error('Erreur DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
