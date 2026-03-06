-- Script de vérification pour le suivi temps réel
-- Exécuter ce script pour voir les données actuelles

-- 1. Voir toutes les périodes de travail d'aujourd'hui
SELECT 
  id,
  employee_name,
  employee_email,
  type,
  start_time,
  end_time,
  is_temporary,
  notes,
  created_at
FROM work_schedules
WHERE work_date = CURRENT_DATE
ORDER BY created_at DESC;

-- 2. Voir uniquement les périodes actives (sans end_time)
SELECT 
  employee_name,
  start_time,
  CASE 
    WHEN notes LIKE '%matin%' THEN 'Matin'
    WHEN notes LIKE '%aprem%' THEN 'Après-midi'
    WHEN notes LIKE '%journee%' THEN 'Journée'
    ELSE 'Non défini'
  END as periode,
  notes,
  NOW() - (CURRENT_DATE + start_time::time) as duree
FROM work_schedules
WHERE work_date = CURRENT_DATE
  AND type = 'work'
  AND (end_time = '' OR end_time IS NULL)
ORDER BY start_time;

-- 3. Compter les périodes par type
SELECT 
  type,
  COUNT(*) as nombre,
  COUNT(*) FILTER (WHERE end_time = '' OR end_time IS NULL) as actives,
  COUNT(*) FILTER (WHERE is_temporary = true) as temporaires
FROM work_schedules
WHERE work_date = CURRENT_DATE
GROUP BY type;

-- 4. Voir les employés actifs avec détails
SELECT 
  u.name,
  u.email,
  ws.start_time,
  ws.type,
  EXTRACT(EPOCH FROM (NOW() - (CURRENT_DATE + ws.start_time::time)))/60 as minutes_travail,
  ws.notes
FROM users u
JOIN work_schedules ws ON ws.user_id = u.id
WHERE u.role = 'employee'
  AND u.active = true
  AND ws.work_date = CURRENT_DATE
  AND ws.type = 'work'
  AND (ws.end_time = '' OR ws.end_time IS NULL);

-- 5. Vérifier les salles (pour GymId dans les notes)
SELECT 
  ws.employee_name,
  SUBSTRING(ws.notes FROM 'GymId: ([a-zA-Z0-9-]+)') as gym_id,
  g.name as gym_name,
  ws.start_time
FROM work_schedules ws
LEFT JOIN gyms g ON g.id = SUBSTRING(ws.notes FROM 'GymId: ([a-zA-Z0-9-]+)')
WHERE ws.work_date = CURRENT_DATE
  AND ws.type = 'work'
  AND (ws.end_time = '' OR ws.end_time IS NULL);
