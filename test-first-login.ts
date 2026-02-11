import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestUser() {
  try {
    // Créer un utilisateur de test en première connexion
    const testUser = await prisma.user.create({
      data: {
        email: 'test@fitevo.com',
        name: 'Utilisateur Test',
        role: 'employee',
        active: true,
        isFirstLogin: true,
        password: null,
        username: null
      }
    })

    console.log('✅ Utilisateur de test créé:', testUser.email)
    console.log('ID:', testUser.id)
  } catch (error) {
    console.error('❌ Erreur:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()
