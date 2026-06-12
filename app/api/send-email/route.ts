import { type NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { verifyAuth } from "@/lib/auth-middleware"
import { sendWorkRecapEmail, sendEmergencyEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request)
  if (!userId) {
    return NextResponse.json({ success: false, message: "Authentification requise" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, data } = body

    logger.info("Email envoyé:", { type, timestamp: new Date().toISOString() })

    if (type === "emergency") {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["admin", "superadmin"] }, active: true },
        select: { email: true },
      })
      const adminEmails = admins.map((a) => a.email)

      const sender = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      })

      await sendEmergencyEmail({
        employeeName: sender?.name ?? data?.employeeName ?? "Employé",
        employeeEmail: sender?.email ?? data?.employeeEmail ?? "",
        message: data?.message ?? "",
        adminEmails,
      })

      return NextResponse.json({ success: true, message: "Alerte d'urgence envoyée" })

    } else if (type === "work-recap") {
      // Récupérer les emails des admins/superadmins actifs
      const admins = await prisma.user.findMany({
        where: { role: { in: ["admin", "superadmin"] }, active: true },
        select: { email: true },
      })
      const adminEmails = admins.map((a) => a.email)

      // Résoudre le nom de la salle si on a un gymId
      let gymName: string = data.gymName || "Non spécifiée"
      if (data.gymId && !data.gymName) {
        const gym = await prisma.gym.findUnique({ where: { id: data.gymId }, select: { name: true } })
        if (gym) gymName = gym.name
      }

      await sendWorkRecapEmail({
        employeeName: data.employeeName ?? "",
        employeeEmail: data.employeeEmail ?? "",
        gymName,
        period: data.period ?? "",
        startTime: data.startTime ?? "",
        endTime: data.endTime ?? "",
        breakDuration: Number(data.breakDuration ?? 0),
        tasksCompleted: Number(data.tasksCompleted ?? 0),
        totalTasks: Number(data.totalTasks ?? 0),
        cashTotal: data.cashTotal !== undefined ? Number(data.cashTotal) : undefined,
        adminEmails,
      })

      return NextResponse.json({ success: true, message: "Email récapitulatif envoyé" })

    } else if (type === "todolist") {
      return NextResponse.json({ success: true, message: "To-do list envoyée" })
    }

    return NextResponse.json({ success: false, message: "Type d'email non reconnu" })
  } catch (error) {
    logger.error("Erreur envoi email", error)
    return NextResponse.json({ success: false, message: "Erreur lors de l'envoi" }, { status: 500 })
  }
}

