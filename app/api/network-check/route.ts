import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    const trueClientIp = request.headers.get('true-client-ip')
    
    const clientIp = cfConnectingIp || trueClientIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    return NextResponse.json({
      success: true,
      ip: clientIp,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération de l\'IP' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gymId } = await request.json()

    if (!gymId) {
      return NextResponse.json(
        { success: false, error: 'ID de salle requis' },
        { status: 400 }
      )
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId }
    })

    if (!gym) {
      return NextResponse.json(
        { success: false, error: 'Salle non trouvée' },
        { status: 404 }
      )
    }

    if (!gym.wifiRestricted) {
      return NextResponse.json({
        success: true,
        allowed: true,
        message: 'Aucune restriction réseau pour cette salle'
      })
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    const trueClientIp = request.headers.get('true-client-ip')
    
    const clientIp = cfConnectingIp || trueClientIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    const expectedIp = gym.ipAddress

    if (!expectedIp) {
      return NextResponse.json({
        success: true,
        allowed: false,
        message: 'Configuration incomplète : adresse IP non configurée pour cette salle',
        clientIp,
        expectedIp: null
      })
    }

    const isLocalDev = clientIp === '127.0.0.1' || 
                       clientIp === '::1' || 
                       clientIp === 'unknown' ||
                       clientIp.startsWith('172.') ||
                       clientIp.startsWith('192.168.') ||
                       clientIp.startsWith('10.')
                       
    const ipMatches = clientIp === expectedIp || isLocalDev

    if (ipMatches) {
      return NextResponse.json({
        success: true,
        allowed: true,
        message: isLocalDev 
          ? 'Mode développement : restriction ignorée' 
          : 'Vous êtes connecté au bon réseau',
        clientIp,
        expectedIp
      })
    } else {
      return NextResponse.json({
        success: true,
        allowed: false,
        message: `Vous devez être connecté au réseau WiFi de la salle "${gym.name}" pour commencer votre période de travail.`,
        hint: gym.wifiSsid ? `Réseau attendu : ${gym.wifiSsid}` : undefined,
        clientIp,
        expectedIp
      })
    }
  } catch (error) {
    logger.error('Erreur vérification réseau', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la vérification du réseau' },
      { status: 500 }
    )
  }
}
