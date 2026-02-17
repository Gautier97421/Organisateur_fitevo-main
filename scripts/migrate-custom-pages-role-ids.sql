-- Migration: Remplacer visible_to par role_ids dans custom_pages
-- Cette migration permet aux admins de définir quels rôles peuvent accéder à chaque page custom

-- 1. Ajouter la nouvelle colonne role_ids de type JSONB
ALTER TABLE custom_pages ADD COLUMN IF NOT EXISTS role_ids JSONB;

-- 2. Supprimer l'ancienne colonne visible_to (si vous ne voulez pas garder les anciennes données)
-- Si vous voulez conserver les données, commentez cette ligne
ALTER TABLE custom_pages DROP COLUMN IF EXISTS visible_to;

-- Note: Les pages existantes auront role_ids = NULL, ce qui signifie qu'elles sont accessibles à tous
-- Les admins devront configurer les rôles via l'interface d'administration
