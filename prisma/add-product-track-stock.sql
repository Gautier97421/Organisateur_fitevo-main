-- Permet de désactiver le suivi de stock pour un article (ex : formule séance, prestation sans stock)

ALTER TABLE products ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT true;
