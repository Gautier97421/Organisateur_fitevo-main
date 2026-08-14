/**
 * Contrôle d'accès partagé pour les routes génériques /api/db/[table] et /api/db/[table]/[id].
 *
 * Ces routes exposent un CRUD générique sur plusieurs modèles Prisma pour éviter de dupliquer
 * des endpoints REST pour chaque table. Comme le nom de table vient du client, cette liste
 * blanche + ces règles de rôle sont la seule chose qui empêche un utilisateur connecté
 * d'atteindre un modèle Prisma arbitraire ou de modifier des champs sensibles (rôle, accès
 * manager, etc.) sur un compte qui n'est pas le sien.
 */

import { prisma } from '@/lib/prisma'

// Source unique de vérité pour le mapping table client -> modèle Prisma.
// Seules les tables listées ici sont accessibles via /api/db/*.
export const DB_TABLE_MODEL: Record<string, string> = {
  calendar_events: 'calendarEvent',
  event_reminders: 'eventReminder',
  gyms: 'gym',
  tasks: 'task',
  work_schedules: 'workSchedule',
  allowed_networks: 'allowedNetwork',
  users: 'user',
  admins: 'user',
  employees: 'user',
  user_gyms: 'userGym',
  new_member_instruction_items: 'newMemberInstructionItem',
  app_config: 'appConfig',
  custom_pages: 'customPage',
  custom_page_items: 'customPageItem',
  roles: 'role',
  cash_movements: 'cashMovement',
}

export function isKnownTable(table: string): boolean {
  return Object.prototype.hasOwnProperty.call(DB_TABLE_MODEL, table)
}

export function resolvePrismaModel(table: string): string {
  return DB_TABLE_MODEL[table]
}

// Tables gérant des comptes utilisateurs — écriture réservée aux admins (voir requireAdminForTable).
export const USER_TABLES = new Set(['users', 'employees', 'admins'])

// Tables de configuration organisationnelle — écriture réservée aux admins.
export const ADMIN_ONLY_TABLES = new Set([
  'gyms',
  'allowed_networks',
  'app_config',
  'roles',
  'new_member_instruction_items',
  'custom_pages',
  'custom_page_items',
])

// Tables où l'écriture est ouverte aux "managers" (admin/superadmin, ou employé avec hasManagerAccess).
// event_reminders : l'UI de programmation de rappel n'est de toute façon affichée qu'aux managers
// (voir calendar-view.tsx / calendar-manager.tsx) ; sans cette entrée, n'importe quel employé
// authentifié pouvait créer/modifier/supprimer le rappel de n'importe quel événement.
export const MANAGER_TABLES = new Set(['user_gyms', 'cash_movements', 'event_reminders'])

// Tables où chaque ligne appartient à un utilisateur (champ Prisma `userId`). Un employé standard
// ne peut créer/modifier/supprimer que ses propres lignes ; un manager/admin peut agir sur toutes.
export const OWNER_TABLES = new Set(['tasks', 'work_schedules', 'calendar_events'])

// Champs qui contrôlent des permissions/rôles — jamais modifiables par un simple employé,
// et le rôle "superadmin" ne peut être accordé que par un superadmin.
export const PROTECTED_USER_FIELDS = [
  'role',
  'active',
  'hasManagerAccess',
  'hasUserManagementAccess',
  'hasCalendarAccess',
  'hasEventProposalAccess',
  'hasWorkScheduleAccess',
  'hasWorkPeriodAccess',
  'roleId',
  'isSuperAdmin',
]

// Champs qu'un manager délégué (employé avec hasManagerAccess + hasUserManagementAccess)
// peut modifier sur le compte d'un autre EMPLOYÉ depuis la page Utilisateurs.
// Volontairement limité aux accès applicatifs : ni identité, ni rôle, ni activation,
// et surtout pas `hasUserManagementAccess` (seul un admin délègue ce droit).
export const DELEGATED_USER_EDITABLE_FIELDS = [
  'hasManagerAccess',
  'hasCalendarAccess',
  'hasEventProposalAccess',
  'hasWorkScheduleAccess',
  'hasWorkPeriodAccess',
]

// Champs du workflow d'approbation des événements calendrier — seul un manager/admin peut les définir,
// sinon un employé pourrait auto-approuver sa propre proposition d'événement.
export const PROTECTED_EVENT_FIELDS = ['status', 'approvedBy', 'approvedAt', 'rejectionReason']

export async function isManagerTier(userId: string, role: string): Promise<boolean> {
  if (role === 'admin' || role === 'superadmin') return true
  if (role !== 'employee') return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { hasManagerAccess: true } })
  return !!user?.hasManagerAccess
}

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'superadmin'
}

/**
 * Employé autorisé par un admin à gérer les accès des autres employés (page Utilisateurs).
 * Suppose déjà l'accès manager : la délégation n'a de sens que pour un manager.
 */
export async function isDelegatedUserManager(userId: string, role: string): Promise<boolean> {
  if (role !== 'employee') return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasManagerAccess: true, hasUserManagementAccess: true },
  })
  return !!user?.hasManagerAccess && !!user?.hasUserManagementAccess
}

/** Retire les champs indiqués d'un objet, en place. */
export function stripFields(obj: Record<string, any>, fields: string[]): void {
  for (const f of fields) {
    if (f in obj) delete obj[f]
  }
}

/** Ne garde que les champs autorisés d'un objet, en place. */
export function keepFields(obj: Record<string, any>, allowed: string[]): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) delete obj[key]
  }
}

/**
 * Cherche un événement planifié (scheduled_events) auquel l'employé est assigné (par email ou
 * par son rôle) et qui tombe dans la période [rangeStart, rangeEnd]. Utilisé pour empêcher un
 * employé de poser un congé qui chevaucherait un événement où il est attendu.
 */
export async function findAssignedEventConflict(
  employeeEmail: string,
  rangeStart: Date,
  rangeEnd: Date
) {
  const user = await prisma.user.findUnique({ where: { email: employeeEmail }, select: { roleId: true } })
  const or: Array<Record<string, string>> = [{ assignedEmployeeEmail: employeeEmail }]
  if (user?.roleId) or.push({ assignedRoleId: user.roleId })

  return prisma.scheduledEvent.findFirst({
    where: {
      eventDate: { gte: rangeStart, lte: rangeEnd },
      OR: or,
    },
  })
}

/** Ne jamais renvoyer le hash du mot de passe au client. */
export function omitPassword<T extends Record<string, any> | null | undefined>(row: T): T {
  if (!row) return row
  if (Array.isArray(row)) {
    return (row as any).map((r: any) => omitPassword(r))
  }
  if (typeof row === 'object' && 'password' in row) {
    const clone: any = { ...row }
    delete clone.password
    return clone
  }
  return row
}
