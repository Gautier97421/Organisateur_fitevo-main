import { Prisma, PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Ajout d'exemples de pages personnalisées...")

  try {
    // Page Nouveau Adhérent (si elle n'existe pas déjà)
    const existingNewMember = await prisma.customPage.findFirst({
      where: { title: 'Nouveau Adhérent' },
    })

    if (!existingNewMember) {
      const newMemberPage = await prisma.customPage.create({
        data: {
          title: 'Nouveau Adhérent',
          icon: 'UserPlus',
          description: "Procédure complète d'inscription d'un nouveau membre",
          orderIndex: 1,
          isActive: true,
          roleIds: Prisma.JsonNull,
          createdBy: 'system',
          items: {
            create: [
              {
                title: "Vérifier la pièce d'identité",
                description:
                  "Demander et vérifier une pièce d'identité valide (carte d'identité, passeport)",
                orderIndex: 1,
                isActive: true,
              },
              {
                title: 'Créer le dossier adhérent',
                description: 'Remplir la fiche adhérent avec toutes les informations personnelles',
                orderIndex: 2,
                isActive: true,
              },
              {
                title: 'Faire signer le règlement intérieur',
                description: 'Expliquer et faire signer le règlement intérieur de la salle',
                orderIndex: 3,
                isActive: true,
              },
              {
                title: "Encaisser l'adhésion",
                description: 'Procéder au paiement et enregistrer dans la caisse',
                orderIndex: 4,
                isActive: true,
              },
              {
                title: 'Remettre la carte de membre',
                description: 'Remettre la carte de membre et expliquer son utilisation',
                orderIndex: 5,
                isActive: true,
              },
            ],
          },
        },
      })
      console.log('✅ Page créée:', newMemberPage.title)
    } else {
      console.log('ℹ️  Page "Nouveau Adhérent" existe déjà')
    }

    // Page Procédure Fermeture
    const existingClosing = await prisma.customPage.findFirst({
      where: { title: 'Procédure Fermeture' },
    })

    if (!existingClosing) {
      const closingPage = await prisma.customPage.create({
        data: {
          title: 'Procédure Fermeture',
          icon: 'Lock',
          description: 'Étapes à suivre pour fermer la salle en fin de journée',
          orderIndex: 2,
          isActive: true,
          roleIds: Prisma.JsonNull,
          createdBy: 'system',
          items: {
            create: [
              {
                title: 'Vérifier que tous les adhérents sont sortis',
                description: "Faire le tour de la salle pour s'assurer qu'il n'y a plus personne",
                orderIndex: 1,
                isActive: true,
              },
              {
                title: 'Éteindre tous les appareils',
                description: 'Éteindre les écrans, la musique et tous les équipements électriques',
                orderIndex: 2,
                isActive: true,
              },
              {
                title: 'Ranger et nettoyer',
                description:
                  'Ranger le matériel, nettoyer les surfaces et vérifier la propreté générale',
                orderIndex: 3,
                isActive: true,
              },
              {
                title: 'Vérifier la caisse',
                description: 'Compter la caisse et remplir le bordereau de fermeture',
                orderIndex: 4,
                isActive: true,
              },
              {
                title: 'Éteindre les lumières et alarme',
                description: "Éteindre toutes les lumières et activer l'alarme",
                orderIndex: 5,
                isActive: true,
              },
              {
                title: 'Verrouiller les portes',
                description: 'Fermer et verrouiller toutes les issues',
                orderIndex: 6,
                isActive: true,
              },
            ],
          },
        },
      })
      console.log('✅ Page créée:', closingPage.title)
    } else {
      console.log('ℹ️  Page "Procédure Fermeture" existe déjà')
    }

    // Page Procédure Ouverture
    const existingOpening = await prisma.customPage.findFirst({
      where: { title: 'Procédure Ouverture' },
    })

    if (!existingOpening) {
      const openingPage = await prisma.customPage.create({
        data: {
          title: 'Procédure Ouverture',
          icon: 'Unlock',
          description: 'Étapes à suivre pour ouvrir la salle en début de journée',
          orderIndex: 3,
          isActive: true,
          roleIds: Prisma.JsonNull,
          createdBy: 'system',
          items: {
            create: [
              {
                title: "Désactiver l'alarme",
                description: "Entrer le code et désactiver le système d'alarme",
                orderIndex: 1,
                isActive: true,
              },
              {
                title: 'Allumer les lumières',
                description: 'Allumer toutes les lumières de la salle',
                orderIndex: 2,
                isActive: true,
              },
              {
                title: 'Vérifier la propreté',
                description: 'Faire un tour de la salle et vérifier que tout est propre et rangé',
                orderIndex: 3,
                isActive: true,
              },
              {
                title: 'Préparer la caisse',
                description: 'Compter le fond de caisse et ouvrir le système',
                orderIndex: 4,
                isActive: true,
              },
              {
                title: 'Allumer les équipements',
                description: "Allumer les écrans, la musique d'ambiance et vérifier les appareils",
                orderIndex: 5,
                isActive: true,
              },
              {
                title: 'Vérifier les plannings',
                description: 'Consulter le planning du jour et les tâches assignées',
                orderIndex: 6,
                isActive: true,
              },
            ],
          },
        },
      })
      console.log('✅ Page créée:', openingPage.title)
    } else {
      console.log('ℹ️  Page "Procédure Ouverture" existe déjà')
    }

    console.log('\n✨ Exemples de pages créés avec succès!')
  } catch (error) {
    console.error('❌ Erreur:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
