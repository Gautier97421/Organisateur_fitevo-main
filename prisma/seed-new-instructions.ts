import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Création de la configuration et des instructions...')

  // Créer la configuration WhatsApp
  await prisma.appConfig.upsert({
    where: { key: 'whatsapp_link' },
    update: {},
    create: {
      key: 'whatsapp_link',
      value: '',
      updatedBy: 'Système'
    }
  })
  console.log('✅ Configuration WhatsApp créée')

  // Supprimer les anciennes instructions si elles existent
  await prisma.newMemberInstructionItem.deleteMany({})

  // Créer les instructions point par point
  const instructions = [
    {
      title: 'Demander une pièce d\'identité',
      description: 'Vérifier et photocopier la pièce d\'identité du nouvel adhérent',
      orderIndex: 1
    },
    {
      title: 'Remplir la fiche d\'inscription',
      description: 'Nom, prénom, date de naissance, adresse, téléphone, email',
      orderIndex: 2
    },
    {
      title: 'Faire signer le règlement intérieur',
      description: 'Expliquer brièvement les règles principales puis faire signer',
      orderIndex: 3
    },
    {
      title: 'Récupérer l\'attestation de santé ou certificat médical',
      description: 'Obligatoire pour l\'inscription',
      orderIndex: 4
    },
    {
      title: 'Présenter les différentes formules',
      description: 'Mensuel, trimestriel, annuel - expliquer les avantages de chaque formule',
      orderIndex: 5
    },
    {
      title: 'Encaisser le paiement',
      description: 'CB, espèces ou chèque - remettre le reçu',
      orderIndex: 6
    },
    {
      title: 'Créer le badge d\'accès',
      description: 'Programmer le badge avec les horaires correspondant à la formule choisie',
      orderIndex: 7
    },
    {
      title: 'Expliquer les horaires d\'ouverture',
      description: 'Indiquer les horaires et les jours de fermeture',
      orderIndex: 8
    },
    {
      title: 'Faire la visite des lieux',
      description: 'Présenter les zones : cardio, musculation, vestiaires, douches',
      orderIndex: 9
    },
    {
      title: 'Expliquer les règles d\'hygiène',
      description: 'Serviette obligatoire, nettoyage des machines après utilisation',
      orderIndex: 10
    },
    {
      title: 'Montrer les casiers et vestiaires',
      description: 'Expliquer le système de cadenas et les règles des vestiaires',
      orderIndex: 11
    },
    {
      title: 'Présenter l\'application mobile',
      description: 'Montrer comment télécharger et utiliser l\'application si disponible',
      orderIndex: 12
    },
    {
      title: 'Expliquer le système de réservation des cours',
      description: 'Comment réserver et annuler les cours collectifs',
      orderIndex: 13
    },
    {
      title: 'Informer des services complémentaires',
      description: 'Coaching personnalisé, conseils nutrition, etc.',
      orderIndex: 14
    },
    {
      title: 'Expliquer les consignes de sécurité',
      description: 'Utilisation correcte des machines, demander de l\'aide si besoin',
      orderIndex: 15
    },
    {
      title: 'Montrer les issues de secours',
      description: 'Indiquer où se trouvent les sorties de secours',
      orderIndex: 16
    }
  ]

  for (const instruction of instructions) {
    await prisma.newMemberInstructionItem.create({
      data: instruction
    })
  }

  console.log(`✅ ${instructions.length} instructions créées`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
