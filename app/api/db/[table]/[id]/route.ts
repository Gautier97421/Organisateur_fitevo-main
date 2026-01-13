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

// PUT - Mettre à jour une entrée
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const { table, id } = await params
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
    console.error(`Erreur PUT /${table}/${id}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer une entrée
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const { table, id } = await params
    
    const prismaModel = tableMapping[table] || table
    
    // @ts-ignore - Accès dynamique au modèle Prisma
    await prisma[prismaModel].delete({
      where: { id },
    })
    
    return NextResponse.json({ success: true, message: 'Supprimé avec succès' })
  } catch (error: any) {
    console.error(`Erreur DELETE /${table}/${id}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
