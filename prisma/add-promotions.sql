-- Ajoute les promotions (BOGO / réduction %) et le lien vers les ventes

CREATE TABLE IF NOT EXISTS promotions (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  gym_id            TEXT,
  buy_product_id    TEXT REFERENCES products(id),
  buy_quantity      INTEGER,
  get_product_id    TEXT REFERENCES products(id),
  get_quantity      INTEGER,
  percentage        DOUBLE PRECISION,
  target_product_id TEXT REFERENCES products(id),
  target_category   TEXT,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS promotion_id TEXT REFERENCES promotions(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount DOUBLE PRECISION NOT NULL DEFAULT 0;
