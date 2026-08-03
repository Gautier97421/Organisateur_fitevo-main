import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { verifyAuthWithRole } from "@/lib/auth-middleware"
import { promises as fs } from "node:fs"
import path from "node:path"
import logger from "@/lib/logger"

const INCIDENTS_DIR = () => {
  const base = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
  return path.join(base, "incidents")
}

const VALID_SCOPES = new Set(["sales", "cash_entries"])

/**
 * POST /api/settings/reset-test-data
 * Vide définitivement des jeux de données (historique des ventes, comptages de caisse /
 * informations & photos terrain / récap mensuel — ces trois dernières lisent la même table
 * cash_register_entries). Réservé au superadmin, action irréversible.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthWithRole(request)
  if (!auth || auth.role !== "superadmin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const scope: string[] = Array.isArray(body?.scope) ? body.scope.filter((s: unknown) => VALID_SCOPES.has(String(s))) : []
    if (scope.length === 0) {
      return NextResponse.json({ error: "Aucune donnée sélectionnée" }, { status: 400 })
    }

    const result: { sales?: number; cashEntries?: number; photosDeleted?: number } = {}

    if (scope.includes("sales")) {
      const { count } = await prisma.sale.deleteMany({})
      result.sales = count
    }

    if (scope.includes("cash_entries")) {
      // Supprimer les fichiers photo référencés avant de vider la table — sinon ils restent
      // orphelins sur le disque indéfiniment.
      const entries = await prisma.cashRegisterEntry.findMany({ select: { customValues: true } })
      const filenames = new Set<string>()
      for (const entry of entries) {
        const values = (entry.customValues || {}) as Record<string, any>
        for (const [key, value] of Object.entries(values)) {
          if (key.startsWith("__photos:") && Array.isArray(value)) {
            value.forEach((f) => typeof f === "string" && f && filenames.add(f))
          } else if (key.startsWith("__photo:") && typeof value === "string" && value) {
            filenames.add(value)
          }
        }
      }
      const dir = INCIDENTS_DIR()
      await Promise.all(
        Array.from(filenames).map((filename) => fs.unlink(path.join(dir, filename)).catch(() => {}))
      )

      const { count } = await prisma.cashRegisterEntry.deleteMany({})
      result.cashEntries = count
      result.photosDeleted = filenames.size
    }

    logger.info(`Réinitialisation de données de test par ${auth.userId} — scope: ${scope.join(", ")} — résultat: ${JSON.stringify(result)}`)
    return NextResponse.json({ data: result })
  } catch (error) {
    logger.error("Erreur réinitialisation des données de test", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
