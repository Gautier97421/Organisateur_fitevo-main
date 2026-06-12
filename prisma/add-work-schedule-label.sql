-- Ajout du label (travail / congés) et de la date de fin sur les plannings
ALTER TABLE work_schedules ADD COLUMN IF NOT EXISTS label VARCHAR(20) NOT NULL DEFAULT 'travail';
ALTER TABLE work_schedules ADD COLUMN IF NOT EXISTS end_date DATE;

-- Marqueur d'envoi de notification pour les événements programmés non validés
ALTER TABLE scheduled_events ADD COLUMN IF NOT EXISTS validation_notified_at TIMESTAMP WITH TIME ZONE;

-- Accès manager (peut gérer les plannings des autres employés)
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_manager_access BOOLEAN NOT NULL DEFAULT false;
