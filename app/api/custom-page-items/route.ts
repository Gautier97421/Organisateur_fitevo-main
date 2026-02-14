import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get("pageId")
    
    if (!pageId) {
      return NextResponse.json(
        { data: null, error: "pageId manquant" },
        { status: 400 }
      )
    }

    const items = await prisma.customPageItem.findMany({
      where: { pageId },
      orderBy: { orderIndex: "asc" }
    })

    return NextResponse.json({ data: items, error: null })
  } catch (error) {
    console.error("[API] Error fetching custom page items:", error)
    return NextResponse.json(
      { data: null, error: "Erreur lors de la récupération des éléments" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pageId, title, description } = body

    // Récupérer le dernier orderIndex pour cette page
    const lastItem = await prisma.customPageItem.findFirst({
      where: { pageId },
      orderBy: { orderIndex: "desc" }
    })
    const nextOrder = (lastItem?.orderIndex ?? 0) + 1

    const item = await prisma.customPageItem.create({
      data: {
        pageId,
        title,
        description,
        orderIndex: nextOrder,
        isActive: true
      }
    })

    return NextResponse.json({ data: item, error: null })
  } catch (error) {
    console.error("[API] Error creating custom page item:", error)
    return NextResponse.json(
      { data: null, error: "Erreur lors de la création de l'élément" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    
    if (!id) {
      return NextResponse.json(
        { data: null, error: "ID manquant" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const item = await prisma.customPageItem.update({
      where: { id: parseInt(id) },
      data: body
    })

    return NextResponse.json({ data: item, error: null })
  } catch (error) {
    console.error("[API] Error updating custom page item:", error)
    return NextResponse.json(
      { data: null, error: "Erreur lors de la mise à jour de l'élément" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    
    if (!id) {
      return NextResponse.json(
        { data: null, error: "ID manquant" },
        { status: 400 }
      )
    }

    await prisma.customPageItem.delete({
      where: { id: parseInt(id) }
    })

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    console.error("[API] Error deleting custom page item:", error)
    return NextResponse.json(
      { data: null, error: "Erreur lors de la suppression de l'élément" },
      { status: 500 }
    )
  }
}
