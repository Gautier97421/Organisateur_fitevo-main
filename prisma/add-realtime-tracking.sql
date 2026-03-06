-- Migration pour ajouter les champs de suivi temps réel aux périodes de travail
-- Date: 2026-03-04

-- Ajouter le champ is_temporary pour distinguer les périodes temporaires des périodes de calendrier
ALTER TABLE work_schedules 
ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;

-- Ajouter les champs de comptage de tâches pour le suivi temps réel
ALTER TABLE work_schedules 
ADD COLUMN IF NOT EXISTS tasks_completed INTEGER DEFAULT 0;

ALTER TABLE work_schedules 
ADD COLUMN IF NOT EXISTS total_tasks INTEGER DEFAULT 0;

-- Mettre à jour les périodes existantes qui n'ont pas de end_time comme étant temporaires
-- (ce sont les périodes actives lancées par les employés)
UPDATE work_schedules 
SET is_temporary = true 
WHERE end_time = '' 
AND type = 'work'
AND notes LIKE '%Période:%';

-- Créer un index pour améliorer les performances des requêtes sur is_temporary
CREATE INDEX IF NOT EXISTS idx_work_schedules_is_temporary 
ON work_schedules(is_temporary, work_date);

-- Afficher un résumé
SELECT 
  COUNT(*) FILTER (WHERE is_temporary = true) as periodes_temporaires,
  COUNT(*) FILTER (WHERE is_temporary = false) as periodes_calendrier,
  COUNT(*) as total
FROM work_schedules;
