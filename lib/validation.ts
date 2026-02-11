/**
 * Utilitaires de validation et sanitization pour les routes API
 */

/**
 * Valide un email
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

/**
 * Valide une URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Valide une chaîne: longueur min/max
 */
export function isValidString(str: string, minLength: number = 1, maxLength: number = 1000): boolean {
  if (typeof str !== 'string') return false
  return str.length >= minLength && str.length <= maxLength
}

/**
 * Valide un UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Valide une date ISO 8601
 */
export function isValidDate(date: string): boolean {
  if (typeof date !== 'string') return false
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

/**
 * Valide un nombre entier
 */
export function isValidInt(value: any, min?: number, max?: number): boolean {
  const num = typeof value === 'string' ? parseInt(value, 10) : value
  if (!Number.isInteger(num)) return false
  if (min !== undefined && num < min) return false
  if (max !== undefined && num > max) return false
  return true
}

/**
 * Valide un boolean
 */
export function isValidBoolean(value: any): boolean {
  return typeof value === 'boolean' || value === 'true' || value === 'false'
}

/**
 * Sanitize une chaîne pour empêcher les injections XSS
 * Échappe les caractères HTML dangereux
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize un objet récursivement
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj
  
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item))
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }
  
  return obj
}

/**
 * Valide les champs d'un utilisateur (employees, admins, users)
 */
export function validateUserFields(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Email obligatoire et valide
  if (data.email !== undefined) {
    if (!isValidEmail(data.email)) {
      errors.push('Email invalide')
    }
  }
  
  // Nom: longueur max 100 caractères
  if (data.name !== undefined) {
    if (!isValidString(data.name, 1, 100)) {
      errors.push('Nom invalide (1-100 caractères)')
    }
  }
  
  // Password: minimum 6 caractères
  if (data.password !== undefined) {
    if (!isValidString(data.password, 6, 255)) {
      errors.push('Mot de passe invalide (minimum 6 caractères)')
    }
  }
  
  // Role doit être dans la liste autorisée
  if (data.role !== undefined) {
    const validRoles = ['employee', 'admin', 'superadmin']
    if (!validRoles.includes(data.role)) {
      errors.push('Rôle invalide')
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Valide les champs d'une salle de sport (gyms)
 */
export function validateGymFields(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Nom obligatoire
  if (data.name !== undefined) {
    if (!isValidString(data.name, 1, 100)) {
      errors.push('Nom invalide (1-100 caractères)')
    }
  }
  
  // Adresse
  if (data.address !== undefined && data.address !== null) {
    if (!isValidString(data.address, 0, 500)) {
      errors.push('Adresse invalide (max 500 caractères)')
    }
  }
  
  // WiFi SSID
  if (data.wifiSsid !== undefined && data.wifiSsid !== null) {
    if (!isValidString(data.wifiSsid, 0, 100)) {
      errors.push('SSID WiFi invalide (max 100 caractères)')
    }
  }
  
  // IP Address
  if (data.ipAddress !== undefined && data.ipAddress !== null) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(data.ipAddress)) {
      errors.push('Adresse IP invalide')
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Valide les champs d'une tâche (tasks)
 */
export function validateTaskFields(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Titre obligatoire
  if (data.title !== undefined) {
    if (!isValidString(data.title, 1, 200)) {
      errors.push('Titre invalide (1-200 caractères)')
    }
  }
  
  // Description
  if (data.description !== undefined && data.description !== null) {
    if (!isValidString(data.description, 0, 1000)) {
      errors.push('Description invalide (max 1000 caractères)')
    }
  }
  
  // Type doit être dans la liste
  if (data.type !== undefined) {
    const validTypes = ['checkbox', 'text', 'qcm']
    if (!validTypes.includes(data.type)) {
      errors.push('Type invalide')
    }
  }
  
  // Period doit être dans la liste
  if (data.period !== undefined) {
    const validPeriods = ['matin', 'aprem', 'journee']
    if (!validPeriods.includes(data.period)) {
      errors.push('Période invalide')
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Fonction principale de validation par table
 */
export function validateTableData(table: string, data: any): { valid: boolean; errors: string[] } {
  // Tables d'utilisateurs
  if (table === 'users' || table === 'employees' || table === 'admins') {
    return validateUserFields(data)
  }
  
  // Gyms
  if (table === 'gyms') {
    return validateGymFields(data)
  }
  
  // Tasks
  if (table === 'tasks') {
    return validateTaskFields(data)
  }
  
  // Par défaut: valide (pour les autres tables)
  return { valid: true, errors: [] }
}
