-- Création des tables Supabase

-- Table des administrateurs
CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des tâches
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checkbox', 'text', 'qcm')),
  period TEXT NOT NULL CHECK (period IN ('matin', 'aprem', 'journee')),
  options JSONB,
  required BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des employés
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  remote_work_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des salles
CREATE TABLE IF NOT EXISTS gyms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  wifi_restricted BOOLEAN DEFAULT false,
  wifi_ssid TEXT,
  ip_address TEXT,
  qr_code_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de relation employés-salles (many-to-many)
CREATE TABLE IF NOT EXISTS employee_gyms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, gym_id)
);

-- Table des complétions de tâches
CREATE TABLE IF NOT EXISTS task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('matin', 'aprem', 'journee')),
  completed BOOLEAN DEFAULT false,
  value TEXT,
  work_date DATE NOT NULL,
  gym_id UUID REFERENCES gyms(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_email, task_id, work_date)
);

-- Table des sessions de pause (pour tracking)
CREATE TABLE IF NOT EXISTS break_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('matin', 'aprem', 'journee')),
  work_date DATE NOT NULL,
  gym_id UUID REFERENCES gyms(id),
  break_start TIMESTAMP WITH TIME ZONE NOT NULL,
  break_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des alertes d'urgence
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  message TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES admins(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertion des administrateurs par défaut
INSERT INTO admins (name, email, is_super_admin) VALUES
('Admin Principal', 'admin@salle.com', true),
('Manager Salle', 'manager@salle.com', false)
ON CONFLICT (email) DO NOTHING;

-- Insertion des tâches par défaut
INSERT INTO tasks (title, description, type, period, required, order_index) VALUES
-- Tâches du matin
('Ouverture de la salle', 'Vérifier l''éclairage et la ventilation', 'checkbox', 'matin', true, 1),
('Contrôle des équipements', 'Vérifier le bon fonctionnement des machines', 'checkbox', 'matin', true, 2),
('Température vestiaires', 'Noter la température des vestiaires', 'text', 'matin', true, 3),

-- Tâches de l'après-midi
('Nettoyage intermédiaire', 'État de propreté en milieu de journée', 'qcm', 'aprem', true, 1),
('Vérification matériel', 'Contrôler l''usure des équipements', 'checkbox', 'aprem', true, 2),
('Incidents de la journée', 'Rapporter tout incident ou problème', 'text', 'aprem', false, 3),

-- Tâches de journée entière
('Fermeture sécurisée', 'Vérifier toutes les fermetures', 'checkbox', 'journee', true, 1),
('Bilan de la journée', 'Évaluation générale de la journée', 'qcm', 'journee', true, 2),
('Remarques générales', 'Commentaires ou suggestions', 'text', 'journee', false, 3)
ON CONFLICT DO NOTHING;

-- Mise à jour des options pour les QCM
UPDATE tasks SET options = '["Très propre", "Propre", "À nettoyer", "Sale"]'::jsonb 
WHERE title = 'Nettoyage intermédiaire';

UPDATE tasks SET options = '["Excellente", "Bonne", "Correcte", "Difficile"]'::jsonb 
WHERE title = 'Bilan de la journée';

-- Insertion d'employés de test
INSERT INTO employees (name, email) VALUES
('Marie Dupont', 'marie.dupont@salle.com'),
('Pierre Martin', 'pierre.martin@salle.com'),
('Sophie Leroy', 'sophie.leroy@salle.com')
ON CONFLICT (email) DO NOTHING;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tasks_period ON tasks(period);
CREATE INDEX IF NOT EXISTS idx_task_completions_employee_date ON task_completions(employee_email, work_date);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_resolved ON emergency_alerts(resolved, created_at);
CREATE INDEX IF NOT EXISTS idx_employee_gyms_employee ON employee_gyms(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_gyms_gym ON employee_gyms(gym_id);
CREATE INDEX IF NOT EXISTS idx_break_sessions_employee_date ON break_sessions(employee_email, work_date);
