import { NextRequest, NextResponse } from 'next/server'
import { getSessionSecret } from '@/lib/session-secret'

// Vérifie la signature HMAC-SHA256 (Edge runtime compatible)
async function verifyHmac(data: string, signatureHex: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const sigBytes = new Uint8Array(signatureHex.length / 2)
    for (let i = 0; i < signatureHex.length; i += 2) {
      sigBytes[i / 2] = parseInt(signatureHex.substring(i, i + 2), 16)
    }
    return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
  } catch {
    return false
  }
}

function decodeHex(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Construit la Content-Security-Policy à nonce (défense en profondeur anti-XSS).
 *
 * En production : script-src verrouillé sur un nonce par requête + 'strict-dynamic'
 * (plus de 'unsafe-inline' ni 'unsafe-eval' pour les scripts). Next.js propage le
 * nonce à ses propres balises <script> via l'en-tête CSP de la requête ; next-themes
 * le reçoit via le layout (prop `nonce`).
 *
 * En développement : CSP permissive (le HMR / React Refresh utilisent eval et des
 * scripts inline). Le verrouillage strict ne s'applique donc qu'en prod.
 */
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production'
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-eval' 'unsafe-inline'`

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`, // Tailwind / styles inline
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ws: wss:`, // API same-origin + WebSocket temps réel (Yjs + messagerie)
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    ...(isProd ? [`upgrade-insecure-requests`] : []),
  ].join('; ')
}

function clearSessionAndRedirect(url: URL) {
  const res = NextResponse.redirect(url)
  res.cookies.set('fitevo_session', '', { maxAge: 0, path: '/' })
  return res
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── CSP à nonce : calculée pour toutes les requêtes traversant le proxy ──
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const nonce = btoa(String.fromCharCode(...bytes))
  const csp = buildCsp(nonce)

  // Le nonce + la CSP doivent voyager dans les en-têtes de requête pour que Next
  // et le layout (next-themes) les récupèrent pendant le rendu.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  // Laisse passer la requête en attachant la CSP (réponse) + le nonce (requête).
  const allow = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('Content-Security-Policy', csp)
    return res
  }

  // ── Contrôle d'accès basé sur le rôle (routes protégées uniquement) ──
  const isAdminRoute = pathname.startsWith('/admin')
  const isEmployeeRoute = pathname.startsWith('/employee')

  if (!isAdminRoute && !isEmployeeRoute) {
    return allow()
  }

  const sessionCookie = request.cookies.get('fitevo_session')
  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const parts = sessionCookie.value.split(':')
  if (parts.length !== 2) {
    return clearSessionAndRedirect(new URL('/', request.url))
  }

  const [hexPayload, hmac] = parts
  const secret = getSessionSecret()

  if (!secret) {
    return clearSessionAndRedirect(new URL('/', request.url))
  }

  const isValid = await verifyHmac(hexPayload, hmac, secret)
  if (!isValid) {
    return clearSessionAndRedirect(new URL('/', request.url))
  }

  let payload: { id: string; role: string }
  try {
    payload = JSON.parse(decodeHex(hexPayload))
  } catch {
    return clearSessionAndRedirect(new URL('/', request.url))
  }

  if (isAdminRoute && payload.role !== 'admin' && payload.role !== 'superadmin') {
    return NextResponse.redirect(new URL('/access-denied', request.url))
  }

  if (isEmployeeRoute && payload.role !== 'employee') {
    return NextResponse.redirect(new URL('/access-denied', request.url))
  }

  return allow()
}

export const config = {
  // S'applique à toutes les pages (pour la CSP) sauf les assets statiques et les
  // images optimisées. La protection par rôle ne concerne que /admin et /employee.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon_io|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2)$).*)',
  ],
}
