import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { sendWelcomeEmail } from '../lib/email'

const prisma = new PrismaClient()

const ACTIVATION_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours
const APP_URL = process.env.APP_URL || 'http://localhost:3000'

async function createWithActivationLink(email: string, name: string, role: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`↷ ${email} existe déjà, pas de nouveau lien d'activation`)
    return existing
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: null,
      name,
      role,
      active: true,
      remoteWorkEnabled: true,
      isFirstLogin: true,
    },
  })

  const token = randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_EXPIRY_MS),
    },
  })

  const activationUrl = `${APP_URL}/first-login?email=${encodeURIComponent(email)}&token=${token}`
  await sendWelcomeEmail(email, activationUrl)
  console.log(`✅ ${role} créé: ${email}`)
  console.log(`   Lien d'activation (valable 7 jours) : ${activationUrl}`)

  return user
}

async function main() {
  console.log('🌱 Création des utilisateurs de test...')
  console.log('💡 Les utilisateurs devront définir leur mot de passe via le lien d\'activation ci-dessous (envoyé par email si le SMTP est configuré).')
  console.log('')

  await createWithActivationLink('gautier.hoarau97421@gmail.com', 'Super Administrateur', 'superadmin')
  await createWithActivationLink('admin@fitevo.com', 'Administrateur', 'admin')

  console.log('\n📝 Comptes créés (activation requise via le lien ci-dessus):')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Super Admin:  gautier.hoarau97421@gmail.com')
  console.log('Admin:        admin@fitevo.com')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
