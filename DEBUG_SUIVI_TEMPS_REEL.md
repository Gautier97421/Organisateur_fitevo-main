# Guide de Débogage - Suivi Temps Réel

## Problème : Employés non visibles dans le suivi temps réel

### Étape 1 : Vérifier que l'employé a bien démarré sa période

1. **Connectez-vous en tant qu'employé**
2. Cliquez sur "Commencer ma période de travail"
3. Sélectionnez une salle
4. Validez la période
5. **Ouvrez la console du navigateur (F12)**

Vous devriez voir dans la console :
```
📝 Création de la période de travail: {user_id: "...", employee_email: "...", ...}
✅ Période de travail créée avec succès: {id: "...", ...}
```

Si vous voyez une erreur `❌`, notez le message.

### Étape 2 : Vérifier la base de données

**Option A - Via l'application :**
1. Allez sur `http://localhost:3000/api/db/work_schedules?work_date=2026-03-04`
2. Recherchez votre période dans les résultats JSON

**Option B - Via SQL :**
Exécutez le script `prisma/check-realtime-data.sql` dans votre base de données :
```bash
psql -U votre_user -d votre_database -f prisma/check-realtime-data.sql
```

Vous devriez voir :
- Une ligne avec `end_time = ''` (vide)
- `type = 'work'`
- `is_temporary = true`
- `notes` contenant "Période: matin" (ou aprem/journee)

### Étape 3 : Vérifier le suivi admin

1. **Connectez-vous en tant qu'admin**
2. Allez dans "Suivi Temps Réel"
3. **Ouvrez la console du navigateur (F12)**

Vous devriez voir dans la console :
```
🔄 Chargement des données employés pour le suivi temps réel...
👥 X employés actifs trouvés
📅 Date du jour: 2026-03-04

🔍 Vérification employé: Nom (email@example.com)
  📡 Requête: /api/db/work_schedules?user_id=...&work_date=2026-03-04
  📋 1 période(s) trouvée(s)
    1. type="work", end_time="", is_temporary=true
       notes: "Période: matin | GymId: xyz..."
  ✅ Période active trouvée!
    ✨ Période détectée: matin à 08:30
    ⏱️ Durée: 45min
    📍 Salle: Nom de la salle

📊 Résultat final: 1 employé(s) en activité
  ✓ Nom: matin depuis 45min
```

### Diagnostics courants

#### Problème 1 : "0 période(s) trouvée(s)"
**Cause :** La période n'a pas été créée ou la date ne correspond pas

**Solution :**
1. Vérifiez la console employé pour voir si la création a réussi
2. Vérifiez que vous utilisez la bonne date (aujourd'hui)
3. Vérifiez la base de données directement

#### Problème 2 : "Période trouvée mais pas active"
**Cause :** `end_time` n'est pas vide

**Solution :**
Vérifiez dans la console les détails de la période :
```
1. type="work", end_time="17:00", ...
```
Si `end_time` a une valeur, la période est terminée. L'employé doit démarrer une nouvelle période.

#### Problème 3 : "⚠️ Pas de période trouvée dans les notes"
**Cause :** Le champ `notes` ne contient pas le pattern "Période: X"

**Solution :**
1. Vérifiez le format des notes dans la console
2. Le format attendu est : `Période: matin | GymId: abc123`
3. Si le format est différent, il y a un problème dans le code de création

#### Problème 4 : "❌ Aucune période active"
**Cause :** Toutes les périodes ont un `end_time` rempli

**Console montre :**
```
  ❌ Aucune période active (toutes ont un end_time ou ne sont pas type=work)
```

**Solution :**
- L'employé a terminé sa période (caisse enregistrée)
- Il doit démarrer une nouvelle période

#### Problème 5 : "Résultat final: 0 employé(s) en activité"
**Cause :** Le filtre `currentPeriod !== null` élimine tous les employés

**Solution :**
Regardez dans la console si des employés ont été traités mais avec `currentPeriod = null`. Cela signifie que le pattern de regex ne matche pas les notes.

### Tests manuels

#### Test 1 : Vérifier directement l'API

Dans votre navigateur, allez sur :
```
http://localhost:3000/api/db/work_schedules?work_date=2026-03-04&type=work
```

Cherchez une période avec :
- `"end_time": ""` ou `"end_time": null`
- `"notes"` contenant "Période:"

#### Test 2 : Vérifier qu'un employé est actif

Remplacez `USER_ID` par l'ID de votre employé :
```
http://localhost:3000/api/db/work_schedules?user_id=USER_ID&work_date=2026-03-04
```

### Correction rapide temporaire

Si le problème persiste, vous pouvez créer manuellement une période de test dans la base :

```sql
INSERT INTO work_schedules (
  id, user_id, employee_email, employee_name, 
  work_date, start_time, end_time, type, 
  is_temporary, notes, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'ID_DE_VOTRE_EMPLOYE',
  'email@example.com',
  'Nom Employé',
  CURRENT_DATE,
  '08:00',
  '',
  'work',
  true,
  'Période: matin | GymId: VOTRE_GYM_ID',
  NOW(),
  NOW()
);
```

Ensuite, rafraîchissez le suivi temps réel admin.

### Support

Si après tous ces tests le problème persiste :
1. Copiez TOUS les logs de la console (côté employé ET admin)
2. Prenez une capture d'écran de la réponse API `/api/db/work_schedules?work_date=2026-03-04`
3. Partagez ces informations pour analyse
