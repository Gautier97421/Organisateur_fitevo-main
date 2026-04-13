import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong'
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères')
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une lettre')
  }

  if (!/\d/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre')
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak'

  if (password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)) {
    strength = 'medium'
  }

  if (
    password.length >= 10 &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password)
  ) {
    strength = 'strong'
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  }
}
