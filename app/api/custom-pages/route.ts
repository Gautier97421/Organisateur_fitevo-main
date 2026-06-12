import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import logger from "@/lib/logger"
import { verifyAuth } from "@/lib/auth-middleware"

export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ data: null, error: "Authentification requise" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get("includeInactive") === "true"
    const id = searchParams.get("id")

    // RÃ©cupÃ©ration d'une seule page par id
    if (id) {
      const page = await prisma.customPage.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { orderIndex: "asc" }
          }
        }
      })
      return NextResponse.json({ data: page, error: null })
    }

    const where: any = {}

    // Si on ne demande pas spÃ©cifiquement les inactives, on ne prend que les actives
    if (!includeInactive) {
      where.isActive = true
    }

    const pages = await prisma.customPage.findMany({
      where,
      orderBy: { orderIndex: "asc" },
      include: {
        items: {
          orderBy: { orderIndex: "asc" }
        }
      }
    })

    return NextResponse.json({ data: pages, error: null })
  } catch (error) {
    logger.error("Erreur GET custom pages", error)
    return NextResponse.json(
      { data: null, error: "Erreur lors de la rÃ©cupÃ©ration des pages" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ data: null, error: "Authentification requise" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, icon, description, roleIds, createdBy } = body

    // RÃ©cupÃ©rer le dernier orderIndex
    const lastPage = await prisma.customPage.findFirst({
      orderBy: { orderIndex: "desc" }
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
        isActive: true
      }
    })

    return NextResponse.json({ data: page, error: null })
  } catch (error) {
    logger.error("Erreur POST custom page", error)
    return NextResponse.json(
      { data: null, error: "Erreur lors de la crÃ©ation de la page" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ data: null, error: "Authentification requise" }, { status: 401 })
  }

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
    const page = await prisma.customPage.update({
      where: { id },
      data: body
    })

    return NextResponse.json({ data: page, error: null })
  } catch (error) {
    logger.error("Erreur PATCH custom page", error)
    return NextResponse.json(
      { data: null, error: "Erreur lors de la mise Ã  jour de la page" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ data: null, error: "Authentification requise" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    
    if (!id) {
      return NextResponse.json(
        { data: null, error: "ID manquant" },
        { status: 400 }
      )
    }

    await prisma.customPage.delete({
      where: { id }
    })

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    logger.error("Erreur DELETE custom page", error)
    return NextResponse.json(
      { data: null, error: "Erreur lors de la suppression de la page" },
      { status: 500 }
    )
  }
}
