import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Migration des instructions Nouveau Adhérent vers les pages personnalisées...')
  
  try {
    // Vérifier si des pages personnalisées existent déjà
    const existingPages = await prisma.customPage.count()
    
    if (existingPages === 0) {
      console.log('📝 Création de la page "Nouveau Adhérent"...')
      
      // Créer la page personnalisée
      const newMemberPage = await prisma.customPage.create({
        data: {
          title: 'Nouveau Adhérent',
          icon: 'UserPlus',
          description: 'Procédure d\'inscription d\'un nouveau membre',
          orderIndex: 1,
          isActive: true,
          visibleTo: 'admin',
          createdBy: 'system'
        }
      })
      
      console.log('✅ Page créée:', newMemberPage.title)
      
      // Récupérer les instructions existantes
      const oldInstructions = await prisma.newMemberInstructionItem.findMany({
        orderBy: { orderIndex: 'asc' }
      })
      
      if (oldInstructions.length > 0) {
        console.log(`📋 Migration de ${oldInstructions.length} instructions...`)
        
        // Créer les items dans la nouvelle structure
        for (const instruction of oldInstructions) {
          await prisma.customPageItem.create({
            data: {
              pageId: newMemberPage.id,
              title: instruction.title,
              description: instruction.description,
              orderIndex: instruction.orderIndex,
              isActive: instruction.isActive
            }
          })
        }
        
        console.log('✅ Instructions migrées avec succès')
      } else {
        console.log('ℹ️  Aucune instruction existante à migrer')
      }
    } else {
      console.log('ℹ️  Des pages personnalisées existent déjà, migration ignorée')
    }
    
    console.log('\n✨ Migration terminée avec succès!')
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
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
