# Système de Pages Personnalisées

## 🎯 Vue d'ensemble

Le système de pages personnalisées permet aux **superadmins** de créer dynamiquement des pages de procédures qui apparaîtront comme des onglets dans le panneau d'administration.

## 🔑 Fonctionnalités

### Pour les Superadmins
- **Créer des pages personnalisées** avec un titre, une icône et une description
- **Gérer les étapes** de chaque procédure (ajout, modification, suppression, réorganisation par drag & drop)
- **Définir la visibilité** (admins ou superadmins uniquement)
- **Activer/Désactiver** les pages et les étapes

### Pour les Admins
- **Accéder aux pages** créées par les superadmins
- **Consulter les procédures** étape par étape
- Les pages apparaissent automatiquement comme des onglets après "Suivi"

## 📖 Comment utiliser

### 1. En tant que Superadmin

1. Connectez-vous avec un compte superadmin
2. Accédez à l'onglet **"Gestion Pages"** (dernier onglet)
3. Cliquez sur **"Ajouter une page"**
4. Remplissez les informations :
   - **Titre** : Nom de la procédure (ex: "Nouveau Adhérent", "Procédure Fermeture")
   - **Icône** : Choisissez une icône dans la liste
   - **Description** : Description optionnelle
   - **Visible pour** : Admins ou Superadmins uniquement
5. Cliquez sur **"Ajouter"**

### 2. Ajouter des étapes à une page

1. Une fois sur la liste des pages, l'admin ou le superadmin peut cliquer sur l'onglet de cette page
2. Cliquez sur **"Ajouter une étape"**
3. Saisissez le titre et la description de l'étape
4. Les étapes peuvent être réorganisées par glisser-déposer

### 3. En tant qu'Admin

1. Connectez-vous avec un compte admin
2. Les pages créées par les superadmins apparaissent automatiquement dans les onglets
3. Consultez les procédures étape par étape

## 🎨 Icônes disponibles

Le système propose une sélection d'icônes courantes :
- FileText, UserPlus, Users, Calendar, ClipboardList
- Lock, Unlock, Settings, Star, Heart, Home
- Bell, Mail, Phone, MessageSquare, Package
- ShoppingCart, CreditCard, DollarSign, TrendingUp, BarChart

## 📝 Exemples de pages à créer

- **Nouveau Adhérent** : Procédure d'inscription d'un nouveau membre
- **Procédure Fermeture** : Étapes pour fermer la salle
- **Procédure Ouverture** : Étapes pour ouvrir la salle
- **Gestion des Incidents** : Comment gérer les incidents
- **Protocole Urgence** : Actions en cas d'urgence
- **Maintenance Équipements** : Procédure de maintenance

## 🔄 Migration

La page "Nouveau Adhérent" existante a été automatiquement migrée vers le nouveau système de pages personnalisées lors de la mise à jour.

## 🛠️ API Endpoints

- `GET /api/custom-pages` : Liste des pages
- `POST /api/custom-pages` : Créer une page
- `PATCH /api/custom-pages?id={id}` : Modifier une page
- `DELETE /api/custom-pages?id={id}` : Supprimer une page

- `GET /api/custom-page-items?pageId={pageId}` : Liste des étapes d'une page
- `POST /api/custom-page-items` : Créer une étape
- `PATCH /api/custom-page-items?id={id}` : Modifier une étape
- `DELETE /api/custom-page-items?id={id}` : Supprimer une étape

## 📊 Structure de la base de données

### Table `custom_pages`
- id, title, icon, description
- orderIndex, isActive, visibleTo
- createdBy, createdAt, updatedAt

### Table `custom_page_items`
- id, pageId, title, description
- orderIndex, isActive
- createdAt, updatedAt
