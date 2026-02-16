import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Récupérer l'adresse IP du client depuis plusieurs sources possibles
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare
    const trueClientIp = request.headers.get('true-client-ip') // Akamai
    
    const clientIp = cfConnectingIp || trueClientIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    return NextResponse.json({
      success: true,
      ip: clientIp,
      debug: {
        forwarded,
        realIp,
        cfConnectingIp,
        trueClientIp
      }
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
    const { gymId } = await request.json()

    if (!gymId) {
      return NextResponse.json(
        { success: false, error: 'ID de salle requis' },
        { status: 400 }
      )
    }

    // Récupérer les informations de la salle
    const gym = await prisma.gym.findUnique({
      where: { id: gymId }
    })

    if (!gym) {
      return NextResponse.json(
        { success: false, error: 'Salle non trouvée' },
        { status: 404 }
      )
    }

    // Si la salle n'a pas de restriction WiFi, autoriser
    if (!gym.wifiRestricted) {
      return NextResponse.json({
        success: true,
        allowed: true,
        message: 'Aucune restriction réseau pour cette salle'
      })
    }

    // Récupérer l'adresse IP du client depuis plusieurs sources
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    const trueClientIp = request.headers.get('true-client-ip')
    
    const clientIp = cfConnectingIp || trueClientIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    // Vérifier si l'IP du client correspond à celle de la salle
    const expectedIp = gym.ipAddress

    if (!expectedIp) {
      // Pas d'IP configurée, mais restriction activée = erreur de config
      return NextResponse.json({
        success: true,
        allowed: false,
        message: 'Configuration incomplète : adresse IP non configurée pour cette salle',
        clientIp,
        expectedIp: null
      })
    }

    // Comparaison des IPs
    // Accepter les IPs locales/Docker pour le développement
    const isLocalDev = clientIp === '127.0.0.1' || 
                       clientIp === '::1' || 
                       clientIp === 'unknown' ||
                       clientIp.startsWith('172.') || // Docker network
                       clientIp.startsWith('192.168.') || // LAN
                       clientIp.startsWith('10.') // Private network
                       
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
    console.error('Erreur vérification réseau:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la vérification du réseau' },
      { status: 500 }
    )
  }
}
