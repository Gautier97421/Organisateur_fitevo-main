import { prisma } from './prisma'

// Authentification avec la base de données PostgreSQL
export async function validateCredentials(email: string, password: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.active) {
      return false
    }

    // Vérification simple du mot de passe (en production, utiliser bcrypt)
    return user.password === password
  } catch (error) {
    console.error('Erreur de validation:', error)
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
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@fitevo.com' }
  })

  if (!admin) {
    await prisma.user.create({
      data: {
        email: 'admin@fitevo.com',
        password: 'admin123',
        name: 'Admin',
        role: 'admin',
        active: true
      }
    })
  }
}
