import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: any = {}

    if (!includeInactive) {
      where.isActive = true
    }

    const pages = await prisma.customPage.findMany({
      where,
      orderBy: { orderIndex: 'asc' },
      include: {
        items: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    })

    return NextResponse.json({ data: pages, error: null })
  } catch (error) {
    logger.error('Error fetching custom pages', error)
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la récupération des pages' },
      { status: 500 },
    )
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

    const body = await request.json()
    const { title, icon, description, roleIds, createdBy } = body

    const lastPage = await prisma.customPage.findFirst({
      orderBy: { orderIndex: 'desc' },
    })
    const nextOrder = (lastPage?.orderIndex ?? 0) + 1

    const page = await prisma.customPage.create({
      data: {
        title,
        icon,
        description,
        roleIds: roleIds || null,
        createdBy,
        orderIndex: nextOrder,
        isActive: true,
      },
    })

    return NextResponse.json({ data: page, error: null })
  } catch (error) {
    logger.error('Error creating custom page', error)
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la création de la page' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ data: null, error: 'ID manquant' }, { status: 400 })
    }

    const body = await request.json()
    const page = await prisma.customPage.update({
      where: { id },
      data: body,
    })

    return NextResponse.json({ data: page, error: null })
  } catch (error) {
    logger.error('Error updating custom page', error)
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la mise à jour de la page' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ data: null, error: 'ID manquant' }, { status: 400 })
    }

    await prisma.customPage.delete({
      where: { id },
    })

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error('Error deleting custom page', error)
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la suppression de la page' },
      { status: 500 },
    )
  }
}
