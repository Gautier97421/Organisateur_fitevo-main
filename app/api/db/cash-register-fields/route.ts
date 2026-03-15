import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gymId = searchParams.get("gym_id")
    const period = searchParams.get("period")

    let where: any = { isActive: true }

    if (gymId) {
      where = {
        ...where,
        OR: [
          { gymId: null }, // Champs appliqués à toutes les salles
          { gymId } // Champs spécifiques à cette salle
        ]
      }
    }

    if (period) {
      where = {
        ...where,
        OR: [
          ...(where.OR || []),
          { period: null }, // Champs appliqués à toutes les périodes
          { period } // Champs spécifiques à cette période
        ]
      }
    }

    const fields = await prisma.cashRegisterField.findMany({
      where,
      orderBy: { orderIndex: "asc" }
    })

    return NextResponse.json({ data: fields }, { status: 200 })
  } catch (error) {
    console.error("Erreur lors de la récupération des champs de caisse:", error)
    return NextResponse.json({ error: "Impossible de récupérer les champs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { label, fieldType, isRequired, period, gymId, createdBy } = body

    if (!label || !createdBy) {
      return NextResponse.json(
        { error: "Label et createdBy sont obligatoires" },
        { status: 400 }
      )
    }

    // Récupérer le prochain index de sélection
    const maxOrder = await prisma.cashRegisterField.aggregate({
      _max: { orderIndex: true },
      where: { isActive: true }
    })
    const nextOrder = (maxOrder._max.orderIndex ?? -1) + 1

    const field = await prisma.cashRegisterField.create({
      data: {
        label,
        fieldType: fieldType || "number",
        isRequired: isRequired || false,
        period: period || null,
        gymId: gymId || null,
        orderIndex: nextOrder,
        createdBy
      }
    })

    return NextResponse.json({ data: field }, { status: 201 })
  } catch (error) {
    console.error("Erreur lors de la création du champ de caisse:", error)
    return NextResponse.json(
      { error: "Impossible de créer le champ de caisse" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, label, fieldType, isRequired, orderIndex } = body

    if (!id) {
      return NextResponse.json({ error: "ID est obligatoire" }, { status: 400 })
    }

    const field = await prisma.cashRegisterField.update({
      where: { id },
      data: {
        label,
        fieldType,
        isRequired,
        orderIndex
      }
    })

    return NextResponse.json({ data: field }, { status: 200 })
  } catch (error) {
    console.error("Erreur lors de la mise à jour du champ de caisse:", error)
    return NextResponse.json(
      { error: "Impossible de mettre à jour le champ de caisse" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID est obligatoire" }, { status: 400 })
    }

    await prisma.cashRegisterField.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Champ de caisse supprimé" }, { status: 200 })
  } catch (error) {
    console.error("Erreur lors de la suppression du champ de caisse:", error)
    return NextResponse.json(
      { error: "Impossible de supprimer le champ de caisse" },
      { status: 500 }
    )
  }
}
