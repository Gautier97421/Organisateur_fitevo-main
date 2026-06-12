-- Ajoute la colonne user_ids aux dossiers pour la visibilité par personnes spécifiques
ALTER TABLE folders ADD COLUMN IF NOT EXISTS user_ids JSON;
