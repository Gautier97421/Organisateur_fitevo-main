-- Délégation « gestion des utilisateurs » à un manager : accès à la page Utilisateurs
-- (employés uniquement) pour accorder/retirer l'accès manager. La création, la
-- suppression et la promotion en admin restent réservées aux administrateurs.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "has_user_management_access" BOOLEAN NOT NULL DEFAULT false;
