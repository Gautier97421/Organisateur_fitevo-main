import { NextRequest, NextResponse } from "next/server"

// GET - Récupérer l'adresse IP publique du client
export async function GET(request: NextRequest) {
  try {
    // Récupérer l'IP depuis les headers (dans l'ordre de priorité)
    const forwardedFor = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    const cfConnectingIp = request.headers.get("cf-connecting-ip")
    const trueClientIp = request.headers.get("true-client-ip")
    
    // x-forwarded-for peut contenir plusieurs IPs séparées par des virgules
    // La première est généralement l'IP du client original
    let clientIp = cfConnectingIp || 
                   trueClientIp || 
                   (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
                   realIp ||
                   "unknown"
    
    // Vérifier si c'est une IP locale (pour le développement)
    const isLocalIp = clientIp === "127.0.0.1" || 
                      clientIp === "::1" || 
                      clientIp.startsWith("192.168.") ||
                      clientIp.startsWith("10.") ||
                      clientIp.startsWith("172.")
    
    return NextResponse.json({
      ip: clientIp,
      isLocal: isLocalIp,
      message: isLocalIp 
        ? "Vous êtes en réseau local. En production, l'IP publique sera détectée automatiquement."
        : "IP publique détectée avec succès."
    })
  } catch (error) {
    console.error("[API] Error getting client IP:", error)
    return NextResponse.json(
      { ip: null, error: "Erreur lors de la récupération de l'adresse IP" },
      { status: 500 }
    )
  }
}
