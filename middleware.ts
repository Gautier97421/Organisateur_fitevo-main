import { NextRequest, NextResponse } from 'next/server'

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

function clearSessionAndRedirect(url: URL, request: NextRequest) {
  const res = NextResponse.redirect(url)
  res.cookies.set('fitevo_session', '', { maxAge: 0, path: '/' })
  return res
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminRoute = pathname.startsWith('/admin')
  const isEmployeeRoute = pathname.startsWith('/employee')

  if (!isAdminRoute && !isEmployeeRoute) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get('fitevo_session')
  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const parts = sessionCookie.value.split(':')
  if (parts.length !== 2) {
    return clearSessionAndRedirect(new URL('/', request.url), request)
  }

  const [hexPayload, hmac] = parts
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET

  if (!secret) {
    return clearSessionAndRedirect(new URL('/', request.url), request)
  }

  const isValid = await verifyHmac(hexPayload, hmac, secret)
  if (!isValid) {
    return clearSessionAndRedirect(new URL('/', request.url), request)
  }

  let payload: { id: string; role: string }
  try {
    payload = JSON.parse(decodeHex(hexPayload))
  } catch {
    return clearSessionAndRedirect(new URL('/', request.url), request)
  }

  // Contrôle d'accès basé sur le rôle
  if (isAdminRoute && payload.role !== 'admin' && payload.role !== 'superadmin') {
    return NextResponse.redirect(new URL('/access-denied', request.url))
  }

  if (isEmployeeRoute && payload.role !== 'employee') {
    return NextResponse.redirect(new URL('/access-denied', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/employee/:path*'],
}
