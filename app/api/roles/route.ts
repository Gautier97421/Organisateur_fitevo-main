import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import logger from '@/lib/logger'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roles = await (prisma as any).role.findMany({
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ data: roles, error: null })
  } catch (error: any) {
    logger.error('Erreur GET roles', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des rôles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, color } = await request.json()

    if (!name || !color) {
      return NextResponse.json({ error: 'Le nom et la couleur sont requis' }, { status: 400 })
    }

    const existing = await (prisma as any).role.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ data: existing })
    }

    const role = await (prisma as any).role.create({
      data: { name, color },
    })

    return NextResponse.json({ data: role })
  } catch (error: any) {
    logger.error('Erreur POST role', error)
    return NextResponse.json({ error: 'Erreur lors de la création du rôle' }, { status: 500 })
  }
}
