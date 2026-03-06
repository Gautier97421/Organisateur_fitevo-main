# Système de Suivi Temps Réel et Gestion des Périodes de Travail

## Vue d'ensemble

Ce système permet un suivi en temps réel de l'activité des employés tout en maintenant un historique propre des périodes de travail pour la paie.

## Deux Types de Périodes de Travail

### 1. Périodes Temporaires (`is_temporary = true`)

**Source :** Lancées par les employés via "Commencer ma période de travail"

**Caractéristiques :**
- Créées automatiquement quand un employé démarre une période (matin, après-midi, ou journée)
- Contiennent les compteurs de tâches en temps réel (`tasks_completed`, `total_tasks`)
- Permettent le suivi en temps réel par les administrateurs
- **Nettoyées automatiquement** chaque jour pour ne pas encombrer la base de données
- Supprimées à la fin de la journée (à minuit)

**Champs spécifiques :**
```sql
is_temporary = true
tasks_completed = nombre de tâches complétées (mis à jour en temps réel)
total_tasks = nombre total de tâches pour cette période
notes = "Période: matin | GymId: xyz..."
```

### 2. Périodes de Calendrier (`is_temporary = false`)

**Source :** Créées par les administrateurs dans le calendrier de travail

**Caractéristiques :**
- Créées manuellement par les admins pour planifier les horaires
- Conservées **définitivement** dans la base de données
- Utilisées pour :
  - Affichage des emplois du temps
  - Calcul des heures travaillées
  - Historique pour la paie (mensuelle, annuelle)
  - Rapports et statistiques

**Champs spécifiques :**
```sql
is_temporary = false
status = 'scheduled' | 'confirmed' | 'completed'
start_time = "08:00"
end_time = "17:00"
```

## Suivi Temps Réel

### Pour les Employés

Lorsqu'un employé :
1. Démarre une période de travail → création d'un `work_schedule` temporaire
2. Coche une tâche → mise à jour du compteur `tasks_completed` en temps réel
3. Termine sa période → ajout de `end_time` et conservation temporaire

### Pour les Administrateurs

Le composant `real-time-monitor.tsx` affiche :
- Les employés actuellement en activité
- La période de travail en cours (matin/après-midi/journée)
- Le nombre de tâches complétées / total (mis à jour toutes les 10 secondes)
- Le statut de pause
- La dernière activité

**Rafraîchissement :** 10 secondes (configurable dans le composant)

## Nettoyage Automatique

### API de Nettoyage

**Endpoint :** `/api/cleanup-temp-periods`

**Méthodes :**
- `GET` : Vérifie combien de périodes peuvent être supprimées
- `POST` : Supprime les périodes temporaires du jour précédent

**Exemple d'utilisation :**
```bash
# Vérifier
curl http://localhost:3000/api/cleanup-temp-periods

# Nettoyer
curl -X POST http://localhost:3000/api/cleanup-temp-periods
```

### Configuration Cron

Pour automatiser le nettoyage quotidien, configurez un cron job :

#### Option 1 : Cron Linux/Mac
```bash
# Ouvrir crontab
crontab -e

# Ajouter cette ligne (exécution à 2h du matin chaque jour)
0 2 * * * curl -X POST http://localhost:3000/api/cleanup-temp-periods
```

#### Option 2 : Tâche planifiée Windows
```powershell
# Créer une tâche planifiée
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-Command `"Invoke-RestMethod -Uri 'http://localhost:3000/api/cleanup-temp-periods' -Method Post`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Nettoyage Périodes Temporaires" -Description "Nettoie les périodes de travail temporaires chaque jour"
```

#### Option 3 : Service Cloud (Vercel, Heroku, etc.)
Utilisez un service de cron externe comme :
- **Vercel Cron Jobs** (si hébergé sur Vercel)
- **EasyCron** (https://www.easycron.com/)
- **cron-job.org** (https://cron-job.org/)

Configuration :
- URL : `https://votre-domaine.com/api/cleanup-temp-periods`
- Méthode : POST
- Fréquence : Quotidienne à 2h du matin

## Migration de la Base de Données

### 1. Appliquer le schéma Prisma

```bash
npx prisma generate
npx prisma db push
```

### 2. Exécuter le script SQL

```bash
# PostgreSQL
psql -U votre_user -d votre_database -f prisma/add-realtime-tracking.sql

# Ou via l'interface SQL de votre hébergeur
```

### 3. Vérifier les changements

```sql
-- Vérifier la structure
\d work_schedules

-- Vérifier les données
SELECT is_temporary, COUNT(*) 
FROM work_schedules 
GROUP BY is_temporary;
```

## Architecture Technique

### Flux de Données - Démarrage d'une Période

```
Employé clique "Commencer ma période"
  ↓
Sélection salle + vérification WiFi
  ↓
Comptage des tâches disponibles
  ↓
Création work_schedule avec:
  - is_temporary = true
  - tasks_completed = 0
  - total_tasks = X (nombre de tâches)
  - start_time = heure actuelle
  - end_time = "" (vide)
```

### Flux de Données - Validation d'une Tâche

```
Employé valide une tâche
  ↓
Sauvegarde dans table tasks
  ↓
Mise à jour work_schedule:
  - tasks_completed += 1
  - updated_at = maintenant
  ↓
Admin voit le changement en temps réel
(rafraîchissement automatique 10s)
```

### Flux de Données - Fin de Période

```
Employé termine sa période (caisse)
  ↓
Mise à jour work_schedule:
  - end_time = heure actuelle
  - notes += "| Pause: X min"
  ↓
Période devient inactive
  ↓
Nettoyée automatiquement le lendemain
```

## Avantages du Système

### Performance
- ✅ Pas besoin de requêter toutes les tâches à chaque rafraîchissement
- ✅ Lecture directe des compteurs dans work_schedules
- ✅ Base de données plus légère (nettoyage automatique)

### Fonctionnalité
- ✅ Suivi en temps réel vraiment temps réel (10s)
- ✅ Historique conservé pour la paie
- ✅ Distinction claire entre périodes actives et planning

### Maintenance
- ✅ Nettoyage automatique quotidien
- ✅ Pas d'accumulation de données inutiles
- ✅ Facile à monitorer et déboguer

## Dépannage

### Les périodes temporaires ne se nettoient pas

1. Vérifier le cron job :
   ```bash
   # Linux
   crontab -l
   
   # Windows
   Get-ScheduledTask | Where-Object {$_.TaskName -like "*Nettoyage*"}
   ```

2. Tester manuellement l'API :
   ```bash
   curl -X POST http://localhost:3000/api/cleanup-temp-periods
   ```

3. Vérifier les logs :
   ```bash
   # Rechercher dans les logs
   grep "cleanup" logs/*.log
   ```

### Le suivi temps réel ne fonctionne pas

1. Vérifier que `is_temporary = true` pour les périodes actives :
   ```sql
   SELECT * FROM work_schedules 
   WHERE work_date = CURRENT_DATE 
   AND is_temporary = true 
   AND end_time = '';
   ```

2. Vérifier que les compteurs sont mis à jour :
   ```sql
   SELECT employee_name, tasks_completed, total_tasks, updated_at
   FROM work_schedules 
   WHERE work_date = CURRENT_DATE 
   AND is_temporary = true;
   ```

3. Vérifier la console du navigateur (F12) pour les erreurs

### Migration échoue

Si la migration SQL échoue :
```sql
-- Rollback manuel si nécessaire
ALTER TABLE work_schedules DROP COLUMN IF EXISTS is_temporary;
ALTER TABLE work_schedules DROP COLUMN IF EXISTS tasks_completed;
ALTER TABLE work_schedules DROP COLUMN IF EXISTS total_tasks;

-- Puis réessayer
```

## Prochaines Améliorations Possibles

- [ ] WebSocket pour suivi en temps réel sans polling
- [ ] Notifications push aux admins quand un employé termine
- [ ] Export automatique des périodes de travail en fin de mois
- [ ] Dashboard de statistiques sur les performances
- [ ] Alertes si employé ne progresse pas sur ses tâches

## Support

Pour toute question ou problème, contactez l'équipe technique.
