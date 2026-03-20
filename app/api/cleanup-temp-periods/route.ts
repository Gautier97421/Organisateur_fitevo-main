import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * API pour nettoyer les périodes de travail temporaires (is_temporary = true)
 * 
 * Les périodes temporaires sont celles lancées par les employés via "Commencer ma période de travail"
 * Elles sont automatiquement supprimées après la fin de la journée pour ne pas encombrer la base de données
 * 
 * Les périodes de calendrier (is_temporary = false) sont conservées pour le suivi des heures et la paie
 * 
 * Cette API peut être appelée manuellement ou via un cron job
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('Début du nettoyage des périodes temporaires')
    
    // Calculer la date d'hier à minuit
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    // Supprimer toutes les périodes temporaires datant d'avant aujourd'hui
    // @ts-ignore - Le champ isTemporary existe dans le schéma mais le client doit être rechargé
    const workSchedulesResult = await prisma.workSchedule.deleteMany({
      where: {
        isTemporary: true,
        date: {
          lt: todayStart // Avant aujourd'hui à minuit
        }
      }
    })

    // Supprimer les tâches complétées des jours précédents (historique quotidien non nécessaire)
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

/**
 * GET - Vérifier combien de périodes temporaires peuvent être nettoyées
 */
export async function GET(request: NextRequest) {
  try {
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
