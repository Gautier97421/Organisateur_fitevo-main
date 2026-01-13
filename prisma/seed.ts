import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Création des utilisateurs de test...')

  // Super Admin
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@fitevo.com' },
    update: {},
    create: {
      email: 'superadmin@fitevo.com',
      password: 'superadmin123',
      name: 'Super Administrateur',
      role: 'superadmin',
      active: true,
      remoteWorkEnabled: true,
    },
  })
  console.log('✅ Super Admin créé:', superadmin.email)

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fitevo.com' },
    update: {},
    create: {
      email: 'admin@fitevo.com',
      password: 'admin123',
      name: 'Administrateur',
      role: 'admin',
      active: true,
      remoteWorkEnabled: true,
    },
  })
  console.log('✅ Admin créé:', admin.email)

  // Employé
  const employee = await prisma.user.upsert({
    where: { email: 'employe@fitevo.com' },
    update: {},
    create: {
      email: 'employe@fitevo.com',
      password: 'employe123',
      name: 'Employé Test',
      role: 'employee',
      active: true,
      remoteWorkEnabled: false,
    },
  })
  console.log('✅ Employé créé:', employee.email)

  console.log('\n📝 Comptes créés:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Super Admin:')
  console.log('  Email: superadmin@fitevo.com')
  console.log('  Password: superadmin123')
  console.log('\nAdmin:')
  console.log('  Email: admin@fitevo.com')
  console.log('  Password: admin123')
  console.log('\nEmployé:')
  console.log('  Email: employe@fitevo.com')
  console.log('  Password: employe123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
