# Organisateur FitEvo

Application de gestion des salles de sport — planning, pointage, caisse, tâches, urgences.

## Stack technique

- **Framework** : Next.js 14+ App Router (TypeScript)
- **Base de données** : PostgreSQL via Prisma ORM
- **Authentification** : Cookies de session HMAC-SHA256 (HttpOnly, Secure, SameSite=Strict), expiration 8h
- **Mots de passe** : bcryptjs 12 rounds (fallback SHA-256 pour migration anciens comptes)
- **UI** : Tailwind CSS + shadcn/ui
- **Package manager** : pnpm
- **Déploiement** : Docker + docker-compose

---

## Installation

```bash
pnpm install
cp .env.example .env.local
# Remplir les variables d'environnement (voir section ci-dessous)
pnpm prisma migrate dev
pnpm dev
```

### Variables d'environnement requises

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `SESSION_SECRET` ou `NEXTAUTH_SECRET` | Secret HMAC pour les cookies de session (32 caractères min.) |
| `APP_URL` ou `NEXTAUTH_URL` | URL publique de l'application |
| `SMTP_HOST` | Serveur SMTP pour les emails |
| `SMTP_PORT` | Port SMTP (587 recommandé) |
| `SMTP_USER` | Utilisateur SMTP |
| `SMTP_PASS` | Mot de passe SMTP |
| `SMTP_FROM` | Adresse expéditeur des emails |
| `ALLOWED_WIFI_IPS` | IPs WiFi autorisées (séparées par virgule) |

---

## Architecture

```
app/
  api/          Routes API Next.js (auth, db CRUD, emails, santé)
  admin/        Interface administrateur
  employee/     Interface employé
  first-login/  Première connexion (création mot de passe)
components/
  admin/        Composants admin (calendrier, caisse, planning, monitoring)
  employee/     Composants employé (pointage, tâches, formulaires)
  auth/         Intercepteur d'authentification
lib/
  auth-middleware.ts  Vérification des sessions côté API
  auth.ts             Utilitaires auth côté client
  password-utils.ts   Hachage bcrypt et migration SHA-256
  logger.ts           Logger conditionnel (dev/prod)
  email.ts            Envoi d'emails via nodemailer
  prisma.ts           Client Prisma singleton
prisma/
  schema.prisma       Schéma de la base de données
```

---

## Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| `superadmin` | Tout — y compris gestion des pages personnalisées et des admins |
| `admin` | Gestion planning, caisse, employés, tâches |
| `employee` / `coach` / etc. | Interface employé uniquement |

---

## Sécurité

- Toutes les routes `/api/db/*` sont protégées par `verifyAuth` (session cookie validé en BDD)
- Le middleware Next.js protège `/admin/*` et `/employee/*` par rôle
- Rate limiting en mémoire : login (5/15min), first-login (5/30min), forgot-password (3/15min)
- Les erreurs serveur ne fuient pas en production (messages génériques renvoyés au client)
- Les logs de debug sont désactivés en production

---

## Système de pages personnalisées

Les superadmins peuvent créer des pages de procédures dynamiques via l'onglet **"Gestion Pages"**.

- Chaque page peut avoir plusieurs étapes réordonnables (drag & drop)
- Visibilité configurable : admins ou superadmins uniquement
- Les pages s'affichent automatiquement comme onglets dans le panneau admin

**API :**
- `GET/POST /api/custom-pages` — Liste et création
- `PATCH/DELETE /api/custom-pages?id={id}` — Modification et suppression
- `GET/POST /api/custom-page-items` — Étapes d'une page
- `PATCH/DELETE /api/custom-page-items?id={id}` — Modification et suppression d'étapes

---

## Suivi temps réel

### Deux types de périodes de travail

| Type | `is_temporary` | Créé par | Conservé |
|------|----------------|----------|----------|
| Pointage employé | `true` | L'employé au démarrage | Jusqu'à minuit (nettoyage auto) |
| Planning admin | `false` | L'admin dans le calendrier | Indéfiniment (historique paie) |

### Monitoring admin

Le composant `real-time-monitor.tsx` affiche les employés actifs, leur progression sur les tâches et leur statut (pause/travail). Rafraîchissement toutes les 10 secondes.

### Nettoyage automatique

**Endpoint :** `/api/cleanup-temp-periods`
- `GET` — Aperçu des périodes à nettoyer
- `POST` — Supprime les périodes temporaires de la veille

---

## Déploiement Docker

```bash
# Développement
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up -d
```

---

## Points à compléter

- [ ] Envoi d'emails en fin de période de travail
- [ ] Envoi d'emails pour les urgences
- [ ] Vérifier le bon fonctionnement de la restriction WiFi en production
