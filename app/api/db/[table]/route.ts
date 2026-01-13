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
  admins: 'user',
  employees: 'user',
  new_member_instruction_items: 'newMemberInstructionItem',
  app_config: 'appConfig',
}

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
  }
  
  // Mapper active -> is_active pour tous les modèles
  if (mapped.active !== undefined) {
    mapped.is_active = mapped.active
    delete mapped.active
  }
  
  // Mapper date -> work_date pour work_schedules
  if (table === 'work_schedules' && mapped.date !== undefined) {
    mapped.work_date = mapped.date
    delete mapped.date
  }
  
  // Mapper eventDate -> event_date pour calendar_events
  if (table === 'calendar_events' && mapped.eventDate !== undefined) {
    mapped.event_date = mapped.eventDate
    delete mapped.eventDate
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
  try {
    const { table } = await params
    const searchParams = request.nextUrl.searchParams
    const isSingle = searchParams.get('single') === 'true'
    
    const prismaModel = tableMapping[table] || table
    
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
          if (field === 'date' || field === 'eventDate') {
            filterValue = value.includes('T') ? value : `${value}T00:00:00.000Z`
          }
          where[field] = { gte: filterValue }
        } else if (key.endsWith('_lte')) {
          let field = snakeToCamel(key.replace('_lte', ''))
          // Mappings spéciaux
          if (field === 'workDate') field = 'date'
          if (field === 'eventDate') field = 'eventDate'
          // Convertir les dates simples en ISO-8601 avec heure
          let filterValue = value
          if (field === 'date' || field === 'eventDate') {
            filterValue = value.includes('T') ? value : `${value}T23:59:59.999Z`
          }
          where[field] = { lte: filterValue }
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
      where.role = 'admin' // Exclure superadmin
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
    
    // Exécuter la requête
    if (isSingle) {
      const data = await (prisma as any)[prismaModel].findFirst({ where, orderBy })
      
      // Mapper les champs du schéma vers les noms attendus par le client
      const mappedData = data ? mapFieldsToClient(table, data) : null
      
      return NextResponse.json({ 
        data: mappedData, 
        error: !data ? { code: 'PGRST116' } : null 
      })
    } else {
      const data = await (prisma as any)[prismaModel].findMany({ where, orderBy })
      
      // Mapper les champs du schéma vers les noms attendus par le client (gère automatiquement les tableaux)
      const mappedData = mapFieldsToClient(table, data)
      
      return NextResponse.json({ data: mappedData || [], error: null })
    }
  } catch (error: any) {
    console.error('Erreur GET:', error)
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
  try {
    const { table } = await params
    const { data } = await request.json()
    const prismaModel = tableMapping[table] || table
    
    if (!data) {
      return NextResponse.json(
        { data: null, error: { message: 'Aucune donnée fournie' } },
        { status: 400 }
      )
    }
    
    const items = Array.isArray(data) ? data : [data]
    
    // Convertir snake_case vers camelCase
    const convertedItems = await Promise.all(items.map(async (item: any) => {
      const converted: any = {}
      for (const [key, value] of Object.entries(item)) {
        let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        
        // Mappings spéciaux pour correspondre au schéma Prisma
        if (camelKey === 'location' && table === 'gyms') {
          camelKey = 'address' // gyms utilise 'address' dans le schéma
        }
        
        // Mapper les champs WiFi de snake_case vers camelCase pour Prisma
        if (table === 'gyms') {
          if (camelKey === 'wifiRestricted') camelKey = 'wifiRestricted'
          if (camelKey === 'wifiSsid') camelKey = 'wifiSsid'
          if (camelKey === 'ipAddress') camelKey = 'ipAddress'
        }
        
        // Mapper is_active -> active pour certains modèles, mais pas pour new_member_instruction_items qui utilise isActive
        if (camelKey === 'isActive' && table !== 'new_member_instruction_items' && table !== 'app_config') {
          camelKey = 'active'
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
        if (camelKey === 'isSuperAdmin') {
          continue // géré via role
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
      if (!converted.userId && (table === 'tasks' || table === 'work_schedules')) {
        const user = await prisma.user.findFirst({ where: { role: 'admin' } })
        if (user) converted.userId = user.id
      }
      
      return converted
    }))
    
    // Insérer dans Prisma
    const results = []
    for (const item of convertedItems) {
      const result = await (prisma as any)[prismaModel].create({ data: item })
      results.push(result)
    }
    
    return NextResponse.json({ data: results, error: null })
  } catch (error: any) {
    console.error('Erreur POST:', error)
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
  try {
    const { table } = await params
    const { data, where } = await request.json()
    const prismaModel = tableMapping[table] || table
    
    // Convertir snake_case vers camelCase
    const converted: any = {}
    for (const [key, value] of Object.entries(data)) {
      let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      
      // Mapper location → address pour les gyms
      if (camelKey === 'location' && table === 'gyms') {
        camelKey = 'address'
      }
      
      // Mapper les champs WiFi pour les gyms
      if (table === 'gyms') {
        if (camelKey === 'wifiRestricted') camelKey = 'wifiRestricted'
        if (camelKey === 'wifiSsid') camelKey = 'wifiSsid'
        if (camelKey === 'ipAddress') camelKey = 'ipAddress'
      }
      
      // Mapper is_active → isActive pour new_member_instruction_items
      if (camelKey === 'isActive' && table !== 'new_member_instruction_items' && table !== 'app_config') {
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
      if (camelKey === 'isSuperAdmin') {
        continue // géré via role
      }
      
      converted[camelKey] = value
    }
    
    // Ne pas permettre de changer le rôle via cette API pour employees/admins
    // Le rôle est fixe selon la table
    if (table === 'employees' || table === 'admins') {
      delete converted.role
    }
    
    const result = await (prisma as any)[prismaModel].updateMany({
      where,
      data: converted,
    })
    
    return NextResponse.json({ data: result, error: null })
  } catch (error: any) {
    console.error('Erreur PUT:', error)
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    )
  }
}

// PATCH - Mettre à jour un seul enregistrement par ID
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    const body = await request.json()
    const prismaModel = tableMapping[table] || table
    
    if (!id) {
      return NextResponse.json(
        { data: null, error: { message: 'ID manquant' } },
        { status: 400 }
      )
    }
    
    // Convertir snake_case vers camelCase
    const converted: any = {}
    for (const [key, value] of Object.entries(body)) {
      let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      
      // Mapper location → address pour les gyms
      if (camelKey === 'location' && table === 'gyms') {
        camelKey = 'address'
      }
      
      // Mapper les champs WiFi pour les gyms
      if (table === 'gyms') {
        if (camelKey === 'wifiRestricted') camelKey = 'wifiRestricted'
        if (camelKey === 'wifiSsid') camelKey = 'wifiSsid'
        if (camelKey === 'ipAddress') camelKey = 'ipAddress'
      }
      
      // Mapper is_active → isActive pour new_member_instruction_items
      if (camelKey === 'isActive' && table !== 'new_member_instruction_items' && table !== 'app_config') {
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
      if (camelKey === 'isSuperAdmin') {
        continue
      }
      
      converted[camelKey] = value
    }
    
    const result = await (prisma as any)[prismaModel].update({
      where: { id: parseInt(id) },
      data: converted,
    })
    
    // Mapper les champs de retour
    const mappedResult = mapFieldsToClient(table, result)
    
    return NextResponse.json({ data: mappedResult, error: null })
  } catch (error: any) {
    console.error('Erreur PATCH:', error)
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    )
  }
}

// DELETE - Supprimer des données
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    const prismaModel = tableMapping[table] || table
    
    if (!id) {
      return NextResponse.json(
        { data: null, error: { message: 'ID requis pour la suppression' } },
        { status: 400 }
      )
    }
    
    // Supprimer l'enregistrement par ID
    const result = await (prisma as any)[prismaModel].delete({
      where: { id: parseInt(id) }
    })
    
    return NextResponse.json({ data: result, error: null })
  } catch (error: any) {
    console.error('Erreur DELETE:', error)
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    )
  }
}
