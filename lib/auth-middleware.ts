import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function verifyAuth(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

export async function getSession() {
  return auth()
}

export async function requireAuth(
  handler: (userId: string, role: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  return handler(session.user.id, session.user.role)
}

export async function requireRole(
  requiredRoles: string[],
  handler: (userId: string, role: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  if (!requiredRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  return handler(session.user.id, session.user.role)
}
