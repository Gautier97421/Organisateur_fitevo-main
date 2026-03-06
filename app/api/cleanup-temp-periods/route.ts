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
    
    // Supprimer toutes les périodes temporaires datant d'avant aujourd'hui
    // @ts-ignore - Le champ isTemporary existe dans le schéma mais le client doit être rechargé
    const result = await prisma.workSchedule.deleteMany({
      where: {
        isTemporary: true,
        date: {
          lt: new Date(new Date().setHours(0, 0, 0, 0)) // Avant aujourd'hui à minuit
        }
      }
    })
    
    logger.info(`Nettoyage terminé: ${result.count} périodes temporaires supprimées`)
    
    return NextResponse.json({ 
      success: true, 
      message: `${result.count} périodes temporaires supprimées`,
      count: result.count 
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
    // @ts-ignore - Le champ isTemporary existe dans le schéma mais le client doit être rechargé
    const count = await prisma.workSchedule.count({
      where: {
        isTemporary: true,
        date: {
          lt: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      count,
      message: `${count} périodes temporaires peuvent être supprimées`
    })
  } catch (error: any) {
    logger.error('Erreur lors de la vérification des périodes temporaires', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de la vérification' },
      { status: 500 }
    )
  }
}
