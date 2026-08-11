/**
 * Répare les données échappées en HTML par l'ancien `sanitizeObject`.
 *
 * Jusqu'au 3 août 2026, `/api/db/[table]` échappait toutes les chaînes avant
 * de les stocker (`'` -> `&#x27;`, `"` -> `&quot;`, etc.). React échappant déjà
 * à l'affichage, le texte apparaissait littéralement à l'écran :
 *   "Les adhérents peuvent venir accompagnés d&#x27;une personne"
 * L'échappement au stockage a été supprimé, mais les lignes écrites avant
 * cette date restent abîmées. Ce script les décode une bonne fois pour toutes.
 *
 * Usage :
 *   pnpm db:fix-entities                    (en local, avec DATABASE_URL)
 *   docker exec fitevo-web pnpm db:fix-entities   (en production)
 *
 * Le script est idempotent : le relancer ne change plus rien une fois les
 * données propres.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Colonnes texte libre des tables qui passaient par /api/db/[table].
 * Volontairement limité à ces tables : les autres (documents collaboratifs,
 * messagerie…) n'ont jamais été échappées et contiennent parfois du HTML
 * légitime qu'il ne faut surtout pas décoder.
 */
const TARGETS: Record<string, string[]> = {
  roles: ['name'],
  users: ['name', 'username'],
  calendar_events: ['title', 'description', 'location', 'created_by_name', 'rejection_reason'],
  // Les événements planifiés ont eu leur propre route très tôt, mais l'ancienne
  // route générique acceptait n'importe quel nom de table en repli : on nettoie
  // aussi ces colonnes par sécurité (sans effet si elles sont déjà propres).
  scheduled_events: ['title', 'description'],
  event_reminders: ['custom_message'],
  gyms: ['name', 'address', 'wifi_ssid'],
  tasks: ['title', 'description'],
  work_schedules: ['employee_name', 'notes'],
  allowed_networks: ['network_name', 'network_ssid'],
  new_member_instruction_items: ['title', 'description'],
  app_config: ['value'],
  custom_pages: ['title', 'description'],
  custom_page_items: ['title', 'description'],
  cash_movements: ['label', 'user_name'],
}

/**
 * `&amp;` doit être décodé en dernier : sinon "&amp;lt;" (un "&lt;" tapé
 * littéralement par un utilisateur) deviendrait "<".
 */
function decodeExpression(column: string): string {
  const quoted = `"${column}"`
  return [
    ['&#x27;', "''''"],
    ['&quot;', '\'"\''],
    ['&lt;', "'<'"],
    ['&gt;', "'>'"],
    ['&amp;', "'&'"],
  ].reduce((expr, [entity, replacement]) => `replace(${expr}, '${entity}', ${replacement})`, quoted)
}

/** Codes PostgreSQL "table inconnue" / "colonne inconnue" : schéma plus ancien. */
const MISSING_OBJECT_CODES = ['42P01', '42703']

function isMissingObject(error: any): boolean {
  const text = `${error?.meta?.code ?? ''} ${error?.code ?? ''} ${error?.message ?? ''}`
  return MISSING_OBJECT_CODES.some((code) => text.includes(code))
}

async function main() {
  let total = 0

  for (const [table, columns] of Object.entries(TARGETS)) {
    for (const column of columns) {
      const sql = `
        UPDATE "${table}"
        SET "${column}" = ${decodeExpression(column)}
        WHERE "${column}" ~ '&(amp|lt|gt|quot|#x27);'
      `
      try {
        const count = await prisma.$executeRawUnsafe(sql)
        if (count > 0) {
          console.log(`✓ ${table}.${column} : ${count} ligne(s) corrigée(s)`)
          total += count
        }
      } catch (error: any) {
        // Une table/colonne absente (schéma plus ancien) ne doit pas tout arrêter ;
        // toute autre erreur (connexion, droits…) doit au contraire être fatale,
        // sinon le script terminerait en annonçant à tort une base propre.
        if (!isMissingObject(error)) throw error
        console.warn(`↷ ${table}.${column} : absente du schéma, ignorée`)
      }
    }
  }

  console.log(
    total === 0
      ? '\nAucune donnée à corriger, la base est déjà propre.'
      : `\n${total} ligne(s) corrigée(s) au total.`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
