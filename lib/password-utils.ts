// Utilitaires pour la gestion des mots de passe
import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'

const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Bcrypt hashes commencent par $2b$ ou $2a$
  if (hash.startsWith('$2b$') || hash.startsWith('$2a$')) {
    return bcrypt.compare(password, hash)
  }
  // Fallback: ancien hash SHA-256 avec sel statique (migration transparente)
  const legacyHash = createHash('sha256')
    .update(password + 'salt_demo_2024')
    .digest('hex')
  return legacyHash === hash
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
  strength: "weak" | "medium" | "strong"
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Le mot de passe doit contenir au moins 8 caractères")
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins une lettre")
  }

  if (!/\d/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins un chiffre")
  }

  let strength: "weak" | "medium" | "strong" = "weak"

  if (password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)) {
    strength = "medium"
  }

  if (
    password.length >= 10 &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password)
  ) {
    strength = "strong"
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  }
}
