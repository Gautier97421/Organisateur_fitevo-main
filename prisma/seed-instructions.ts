import 'dotenv/config'
import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Création des instructions de nouveau adhérent...')

  // Vérifier si des instructions existent déjà
  const existing = await prisma.newMemberInstructionItem.findFirst()

  if (existing) {
    console.log('ℹ️  Les instructions existent déjà')
    return
  }

  // Créer les instructions par défaut
  await prisma.newMemberInstructionItem.create({
    data: {
      title: 'Accueillir un nouveau adhérent',
      description: `Étapes pour accueillir un nouveau adhérent :

1. 📝 INSCRIPTION
   - Demander une pièce d'identité
   - Remplir la fiche d'inscription (nom, prénom, date de naissance, adresse, téléphone, email)
   - Faire signer le règlement intérieur
   - Faire signer l'attestation de santé ou certificat médical

2. 💳 PAIEMENT
   - Présenter les différentes formules (mensuel, trimestriel, annuel)
   - Encaisser le paiement (CB, espèces, chèque)
   - Remettre le reçu de paiement

3. 🔑 ACCÈS
   - Créer le badge d'accès
   - Expliquer les horaires d'ouverture
   - Expliquer le fonctionnement du badge

4. 🏋️ VISITE DES LIEUX
   - Présenter les différentes zones (cardio, musculation, vestiaires)
   - Expliquer les règles d'hygiène (serviette obligatoire)
   - Montrer les casiers et vestiaires
   - Expliquer le système de réservation des cours collectifs

5. 📱 APPLICATION & SERVICES
   - Présenter l'application mobile si disponible
   - Expliquer comment réserver les cours
   - Informer des services complémentaires (coaching, nutrition, etc.)

6. ⚠️ SÉCURITÉ
   - Expliquer les consignes de sécurité
   - Montrer où se trouvent les issues de secours
   - Présenter le personnel disponible en cas de problème

N'hésitez pas à poser des questions si vous avez oublié une étape !`,
      orderIndex: 1,
      isActive: true,
    },
  })

  console.log('✅ Instructions de nouveau adhérent créées')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
