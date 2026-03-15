import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth-middleware"

function normalizeMonth(input?: string): string {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    return input
  }
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const month = normalizeMonth(searchParams.get("month") || undefined)
    const gymId = searchParams.get("gym_id")

    const where: any = { entryMonth: month }
    if (gymId) {
      where.gymId = gymId
    }

    const entries = await prisma.cashRegisterEntry.findMany({
      where,
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    })

    const data = entries.map((entry) => ({
      id: entry.id,
      entry_date: entry.entryDate.toISOString(),
      entry_month: entry.entryMonth,
      period: entry.period,
      gym_id: entry.gymId,
      user_email: entry.userEmail,
      user_name: entry.userName,
      total_register: entry.totalRegister,
      cash_amount: entry.cashAmount,
      coins_detail: entry.coinsDetail,
      notes: entry.notes,
      custom_values: entry.customValues,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
    }))

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error("Erreur récupération récap caisse:", error)
    return NextResponse.json({ error: "Impossible de récupérer le récap caisse" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      entryDate,
      period,
      gymId,
      userEmail,
      userName,
      totalRegister,
      cashAmount,
      coinsDetail,
      notes,
      customValues,
    } = body

    if (!period || !userEmail) {
      return NextResponse.json({ error: "period et userEmail sont obligatoires" }, { status: 400 })
    }

    if (customValues && typeof customValues === "object") {
      for (const [key, value] of Object.entries(customValues as Record<string, any>)) {
        if (value === "" || value === null || value === undefined) {
          continue
        }

        if (typeof value === "number") {
          if (value < 0) {
            return NextResponse.json({ error: `Valeur négative interdite pour ${key}` }, { status: 400 })
          }
          continue
        }

        if (typeof value === "string") {
          const parsed = Number(value)
          if (!Number.isNaN(parsed) && parsed < 0) {
            return NextResponse.json({ error: `Valeur négative interdite pour ${key}` }, { status: 400 })
          }
        }
      }
    }

    const parsedDate = entryDate ? new Date(entryDate) : new Date()
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "entryDate invalide" }, { status: 400 })
    }

    const entryMonth = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`

    const created = await prisma.cashRegisterEntry.create({
      data: {
        entryDate: parsedDate,
        entryMonth,
        period,
        gymId: gymId || null,
        userEmail,
        userName: userName || null,
        totalRegister: Number(totalRegister || 0),
        cashAmount: Number(cashAmount || 0),
        coinsDetail: coinsDetail || null,
        notes: notes || null,
        customValues: customValues || null,
      },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error("Erreur création entrée caisse:", error)
    return NextResponse.json({ error: "Impossible de créer l'entrée caisse" }, { status: 500 })
  }
}
