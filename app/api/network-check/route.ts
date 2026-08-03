import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-middleware'
import logger from '@/lib/logger'

/**
 * Résout l'IP du client en ne faisant confiance qu'aux en-têtes que notre propre reverse proxy
 * (Nginx Proxy Manager, sur npm_network) écrase réellement plutôt qu'il ne les transmet tels quels :
 *  - X-Real-IP : nginx le définit via $remote_addr (écrasé, pas concaténé) — fiable.
 *  - X-Forwarded-For : nginx AJOUTE le vrai IP à la fin de la liste plutôt que de la remplacer,
 *    donc c'est la DERNIÈRE entrée qu'il faut lire, pas la première (que le client peut forger).
 * CF-Connecting-IP / True-Client-IP ne sont pas utilisés : cette app n'est pas derrière
 * Cloudflare/Akamai, donc un client pourrait les envoyer lui-même sans passer par un vrai CDN.
 */
function resolveClientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }

  return 'unknown'
}

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const clientIp = resolveClientIp(request)

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
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 })
  }

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

    const clientIp = resolveClientIp(request)

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

    // En développement local uniquement, ignorer la restriction pour les IPs privées/Docker.
    // En production, on ne bypass JAMAIS : un employé distant ne doit pas pouvoir se faire
    // passer pour présent sur site simplement parce que son IP resolue tombe dans une plage privée.
    const isLocalDev = process.env.NODE_ENV !== 'production' && (
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp === 'unknown' ||
      clientIp.startsWith('172.') ||
      clientIp.startsWith('192.168.') ||
      clientIp.startsWith('10.')
    )

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
