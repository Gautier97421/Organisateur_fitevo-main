import { prisma } from './prisma'
import { verifyPassword } from './password-utils'
import logger from './logger'

// Authentification avec la base de données PostgreSQL
export async function validateCredentials(email: string, password: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.active) {
      return false
    }

    // Vérification sécurisée du mot de passe avec hash
    if (!user.password) {
      return false
    }
    
    return await verifyPassword(password, user.password)
  } catch (error) {
    logger.error('Erreur de validation des credentials', error)
    return false
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('userEmail') !== null
}

export function login(email: string, password: string): boolean {
  // Cette fonction est maintenant gérée par l'API route
  return true
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userName')
    localStorage.removeItem('userRole')
    localStorage.removeItem('isSuperAdmin')
  }
}

// Fonction utilitaire pour créer un utilisateur admin si nécessaire
export async function ensureAdminUser() {
  // Désactivé en production - utiliser le seed de manière contrôlée
  if (process.env.NODE_ENV === 'production') {
    return
  }
  
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@fitevo.com' }
  })

  if (!admin) {
    // Import dynamique pour éviter les erreurs
    const { hashPassword } = await import('./password-utils')
    const hashedPassword = await hashPassword('admin123')
    
    await prisma.user.create({
      data: {
        email: 'admin@fitevo.com',
        password: hashedPassword,
        name: 'Admin',
        role: 'admin',
        active: true,
        isFirstLogin: false
      }
    })
  }
}
