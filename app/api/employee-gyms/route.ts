import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import logger from '@/lib/logger'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const employeeEmail = searchParams.get('employeeEmail')

    if (!employeeId && !employeeEmail) {
      return NextResponse.json({ error: 'employeeId or employeeEmail required' }, { status: 400 })
    }

    let userId = employeeId

    if (employeeEmail && !employeeId) {
      const user = await prisma.user.findUnique({
        where: { email: employeeEmail },
        select: { id: true },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      userId = user.id
    }

    const userGyms = await prisma.userGym.findMany({
      where: { userId: userId || '' },
      include: {
        gym: true,
      },
    })

    const gyms = userGyms.map((ug) => ({
      id: ug.gym.id,
      name: ug.gym.name,
      address: ug.gym.address,
      is_active: ug.gym.isActive,
      wifi_restricted: ug.gym.wifiRestricted,
      wifi_ssid: ug.gym.wifiSsid,
      ip_address: ug.gym.ipAddress,
      qr_code_enabled: ug.gym.qrCodeEnabled,
      created_at: ug.gym.createdAt.toISOString(),
      updated_at: ug.gym.updatedAt.toISOString(),
    }))

    return NextResponse.json({ data: gyms })
  } catch (error: any) {
    logger.error('Error fetching employee gyms', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { employeeId, employeeEmail, gymIds } = body

    if (!employeeId && !employeeEmail) {
      return NextResponse.json({ error: 'employeeId or employeeEmail required' }, { status: 400 })
    }

    if (!gymIds || !Array.isArray(gymIds)) {
      return NextResponse.json({ error: 'gymIds must be an array' }, { status: 400 })
    }

    let userId = employeeId

    if (employeeEmail && !employeeId) {
      const user = await prisma.user.findUnique({
        where: { email: employeeEmail },
        select: { id: true },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      userId = user.id
    }

    await prisma.userGym.deleteMany({
      where: { userId: userId || '' },
    })

    if (gymIds.length > 0) {
      const userGyms = await prisma.userGym.createMany({
        data: gymIds.map((gymId: string) => ({
          userId: userId || '',
          gymId: gymId,
        })),
      })

      return NextResponse.json({ data: userGyms })
    }

    return NextResponse.json({ data: [] })
  } catch (error: any) {
    logger.error('Error updating employee gyms', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const gymId = searchParams.get('gymId')

    if (!employeeId || !gymId) {
      return NextResponse.json({ error: 'employeeId and gymId required' }, { status: 400 })
    }

    await prisma.userGym.deleteMany({
      where: {
        userId: employeeId,
        gymId: gymId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error deleting employee gym', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
