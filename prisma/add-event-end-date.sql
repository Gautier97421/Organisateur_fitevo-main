-- Ajout de la date de fin pour les événements multi-jours (périodes)
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS event_end_date DATE;
