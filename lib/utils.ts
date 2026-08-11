import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * URL publique de l'application, sans slash final.
 *
 * Les liens des emails sont construits par concaténation (`${base}/reset-password`).
 * Un `APP_URL` saisi avec un slash final produisait une double barre
 * (`https://exemple.fr//reset-password`), que certains proxys refusent ou
 * redirigent en perdant le paramètre `token`.
 */
export function getAppBaseUrl(): string {
  const configured =
    process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"
  return configured.trim().replace(/\/+$/, "")
}
