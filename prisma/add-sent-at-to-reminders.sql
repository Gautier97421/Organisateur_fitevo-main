-- Migration: ajout du champ sent_at sur event_reminders
-- Permet de tracer si le rappel a déjà été envoyé par email

ALTER TABLE event_reminders
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
