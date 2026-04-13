import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import logger from '@/lib/logger'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    logger.info('Début du nettoyage des périodes temporaires')
    
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    // @ts-ignore - Le champ isTemporary existe dans le schéma mais le client doit être rechargé
    const workSchedulesResult = await prisma.workSchedule.deleteMany({
      where: {
        isTemporary: true,
        date: {
          lt: todayStart
        }
      }
    })

    const tasksResult = await prisma.task.deleteMany({
      where: {
        status: 'completed',
        updatedAt: {
          lt: todayStart
        }
      }
    })
    
    logger.info(`Nettoyage terminé: ${workSchedulesResult.count} périodes temporaires supprimées, ${tasksResult.count} tâches complétées supprimées`)
    
    return NextResponse.json({ 
      success: true, 
      message: `${workSchedulesResult.count} périodes temporaires supprimées, ${tasksResult.count} tâches complétées supprimées`,
      workSchedulesDeleted: workSchedulesResult.count,
      completedTasksDeleted: tasksResult.count 
    })
  } catch (error: any) {
    logger.error('Erreur lors du nettoyage des périodes temporaires', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors du nettoyage' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    // @ts-ignore - Le champ isTemporary existe dans le schéma mais le client doit être rechargé
    const workSchedulesCount = await prisma.workSchedule.count({
      where: {
        isTemporary: true,
        date: {
          lt: todayStart
        }
      }
    })

    const completedTasksCount = await prisma.task.count({
      where: {
        status: 'completed',
        updatedAt: {
          lt: todayStart
        }
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      workSchedulesCount,
      completedTasksCount,
      message: `${workSchedulesCount} périodes temporaires et ${completedTasksCount} tâches complétées peuvent être supprimées`
    })
  } catch (error: any) {
    logger.error('Erreur lors de la vérification des périodes temporaires', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de la vérification' },
      { status: 500 }
    )
  }
}
