-- Migration : ajout de la table password_reset_tokens
-- Exécuter une seule fois sur la base de données de production

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"         TEXT          NOT NULL,
  "token"      TEXT          NOT NULL,
  "user_id"    TEXT          NOT NULL,
  "expires_at" TIMESTAMPTZ   NOT NULL,
  "used_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "password_reset_tokens_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key"
  ON "password_reset_tokens"("token");
