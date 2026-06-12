-- Ajoute la colonne pinned_message_id aux conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_message_id VARCHAR;
