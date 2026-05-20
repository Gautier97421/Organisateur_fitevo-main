import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Création des utilisateurs de test...')
  console.log('💡 Les utilisateurs devront définir leur mot de passe à la première connexion.')
  console.log('')

  // Super Admin
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@fitevo.com' },
    update: {}, // Ne jamais écraser un mot de passe existant
    create: {
      email: 'superadmin@fitevo.com',
      password: null,
      name: 'Super Administrateur',
      role: 'superadmin',
      active: true,
      remoteWorkEnabled: true,
      isFirstLogin: true,
    },
  })
  console.log('✅ Super Admin créé:', superadmin.email)

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fitevo.com' },
    update: {}, // Ne jamais écraser un mot de passe existant
    create: {
      email: 'admin@fitevo.com',
      password: null,
      name: 'Administrateur',
      role: 'admin',
      active: true,
      remoteWorkEnabled: true,
      isFirstLogin: true,
    },
  })
  console.log('✅ Admin créé:', admin.email)

  // Employé
  const employee = await prisma.user.upsert({
    where: { email: 'employe@fitevo.com' },
    update: {}, // Ne jamais écraser un mot de passe existant
    create: {
      email: 'employe@fitevo.com',
      password: null,
      name: 'Employé Test',
      role: 'employee',
      active: true,
      remoteWorkEnabled: false,
      isFirstLogin: true,
    },
  })
  console.log('✅ Employé créé:', employee.email)

  console.log('\n📝 Comptes créés (première connexion requise):')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Super Admin:  superadmin@fitevo.com')
  console.log('Admin:        admin@fitevo.com')
  console.log('Employé:      employe@fitevo.com')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️  Chaque utilisateur devra définir son mot de passe')
  console.log('   lors de sa première connexion.')
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
