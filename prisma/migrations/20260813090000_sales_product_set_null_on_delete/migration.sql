-- Permet la suppression définitive d'un article sans détruire l'historique des ventes :
-- la vente conserve product_name, unit_price et total, seul le lien vers la fiche produit
-- est effacé (product_id passe à NULL).

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_product_id_fkey";

-- AlterTable
ALTER TABLE "sales" ALTER COLUMN "product_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
