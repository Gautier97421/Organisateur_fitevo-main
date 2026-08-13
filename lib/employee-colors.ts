/**
 * Palette des pastilles employés (planning de travail).
 *
 * Les couleurs sont attribuées par index : l'ordre alterne volontairement les teintes
 * (bleu → rouge → vert → orange…) pour que deux employés voisins dans la liste ne se
 * retrouvent jamais avec deux nuances proches. Les huit dernières sont des versions
 * foncées, utilisées seulement au-delà de 16 employés.
 */
export const EMPLOYEE_COLORS = [
  "bg-blue-500",
  "bg-red-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-purple-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-lime-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-fuchsia-500",
  "bg-sky-600",
  "bg-yellow-500",
  "bg-violet-600",
  "bg-stone-500",
  "bg-blue-900",
  "bg-red-900",
  "bg-green-900",
  "bg-orange-900",
  "bg-purple-900",
  "bg-teal-900",
]

/** Couleur stable d'un employé selon sa position dans la liste. */
export function employeeColorAt(index: number): string {
  return EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length]
}
