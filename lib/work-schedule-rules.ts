/**
 * Règle commune aux plannings de travail : on ne réécrit pas le passé.
 *
 * Le découpage se fait à la journée près — le planning de la veille est figé, celui du
 * jour même et des jours suivants reste modifiable. Utilisé côté employé comme côté
 * admin/manager pour que les deux vues appliquent exactement la même limite.
 */

/**
 * Clé "YYYY-MM-DD" d'une journée du calendrier, dans la convention utilisée par toute
 * l'application pour enregistrer un planning : minuit local converti en UTC.
 *
 * Concrètement, en UTC+2, le 13 août est stocké sous la clé "2026-08-12". C'est décalé,
 * mais c'est cohérent : les cases du calendrier sont lues avec la même transformation.
 * Comparer une date de planning à un jour calculé autrement (jour local, ou `toISOString()`
 * appliqué à l'instant présent) revient à se tromper d'un jour — et faisait passer le
 * planning du jour même pour un planning passé.
 */
export function toDateKey(date: Date): string {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return localMidnight.toISOString().split("T")[0]
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/**
 * Inverse exact de `toDateKey` : retrouve la journée du calendrier à partir de la clé
 * enregistrée. Indispensable pour réafficher une date, car la clé n'est pas la date réelle
 * (le planning du jeudi 13 est stocké "2026-08-12" en UTC+2).
 *
 * On essaie les trois jours voisins et on garde celui qui redonne la clé : ça reste juste
 * quel que soit le décalage horaire, y compris négatif où il n'y a aucun décalage.
 */
export function fromDateKey(key: string): Date | null {
  const [year, month, day] = key.split("-").map(Number)
  if (!year || !month || !day) return null
  for (const delta of [0, 1, -1]) {
    const candidate = new Date(year, month - 1, day + delta)
    if (toDateKey(candidate) === key) return candidate
  }
  return new Date(year, month - 1, day)
}

/**
 * Date d'un planning, prête à afficher. Renvoie "" si la valeur est absente ou illisible,
 * plutôt que le "Invalid Date" que produisait une concaténation naïve.
 */
export function formatScheduleDate(
  workDate: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }
): string {
  if (!workDate) return ""
  const key = workDate instanceof Date ? toDateKey(workDate) : String(workDate).split("T")[0]
  const date = fromDateKey(key)
  if (!date || Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("fr-FR", options)
}

/** Normalise une date de planning ("2026-08-13" ou "2026-08-13T00:00:00.000Z") en "YYYY-MM-DD". */
function dateKeyOf(value: string | Date | null | undefined): string {
  if (!value) return ""
  if (value instanceof Date) return toDateKey(value)
  return value.split("T")[0]
}

interface EditableSchedule {
  work_date: string | Date
  end_date?: string | Date | null
  label?: string | null
}

/** Jour du calendrier tel qu'on l'affiche : "YYYY-MM-DD" en heure locale, sans décalage. */
export function displayDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Période réellement couverte par un planning, en jours affichés.
 *
 * Les deux bornes ne sont pas enregistrées de la même façon : la date de début passe par la
 * clé décalée (`toDateKey`), la date de fin d'un congé est la date brute choisie dans le
 * sélecteur. On les ramène donc toutes les deux au jour affiché avant de comparer, sinon un
 * congé apparaît un jour de trop à la fin.
 */
export function scheduleDayRange(schedule: EditableSchedule): { start: string; end: string } {
  const startDate = schedule.work_date instanceof Date
    ? schedule.work_date
    : fromDateKey(String(schedule.work_date).split("T")[0])
  const start = startDate ? displayDayKey(startDate) : ""

  if ((schedule.label || "travail") !== "conges" || !schedule.end_date) {
    return { start, end: start }
  }

  const end = schedule.end_date instanceof Date
    ? displayDayKey(schedule.end_date)
    : String(schedule.end_date).split("T")[0]

  return { start, end: end > start ? end : start }
}

/**
 * Date de fin d'un congé, prête à afficher. Contrairement à la date de début, elle est
 * enregistrée telle qu'elle a été choisie dans le sélecteur : aucun décalage à annuler.
 */
export function formatScheduleEndDate(
  endDate: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  if (!endDate) return ""
  if (endDate instanceof Date) return endDate.toLocaleDateString("fr-FR", options)
  const [year, month, day] = String(endDate).split("T")[0].split("-").map(Number)
  if (!year || !month || !day) return ""
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", options)
}

/** Le planning couvre-t-il cette journée ? (un congé s'étale sur plusieurs jours) */
export function scheduleCoversDay(schedule: EditableSchedule, day: Date): boolean {
  const { start, end } = scheduleDayRange(schedule)
  if (!start) return false
  const target = displayDayKey(day)
  return start <= target && target <= end
}

/**
 * Dernier jour couvert par le planning : la date de fin pour un congé sur plusieurs jours,
 * la date du jour travaillé sinon.
 */
export function scheduleLastDayKey(schedule: EditableSchedule): string {
  const start = dateKeyOf(schedule.work_date)
  if ((schedule.label || "travail") !== "conges") return start
  const end = dateKeyOf(schedule.end_date)
  return end && end > start ? end : start
}

/**
 * Un planning reste modifiable tant que son dernier jour n'est pas passé : un congé en
 * cours peut donc être écourté, mais une journée déjà terminée est verrouillée.
 */
export function isScheduleEditable(schedule: EditableSchedule, today: string = todayKey()): boolean {
  return scheduleLastDayKey(schedule) >= today
}
