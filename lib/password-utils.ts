// Utilitaires pour la gestion des mots de passe
// Note: En production, utilisez bcrypt ou une bibliothèque similaire

export async function hashPassword(password: string): Promise<string> {
  // Pour la démo, utilisation de crypto simple
  // En production, utilisez bcrypt avec un salt approprié
  const encoder = new TextEncoder()
  const data = encoder.encode(password + "salt_demo_2024")
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
  strength: "weak" | "medium" | "strong"
} {
  const errors: string[] = []

  if (password.length < 6) {
    errors.push("Le mot de passe doit contenir au moins 6 caractères")
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
