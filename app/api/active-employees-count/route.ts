import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Employés ayant une période de travail active aujourd'hui (end_time vide = pas encore terminée)
  const active = await prisma.workSchedule.findMany({
    where: {
      date: { gte: today, lt: tomorrow },
      type: 'work',
      endTime: '',
      user: { role: 'employee', active: true },
    },
    select: { userId: true },
    distinct: ['userId'],
  })

  return NextResponse.json({ count: active.length })
}
