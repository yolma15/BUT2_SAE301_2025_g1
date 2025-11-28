# BUT2 – SAE301 2025 – Groupe 1

## Plateforme de Gestion de Projets Collaboratifs

## 1. Présentation générale du projet

Ce dépôt contient le code source du projet **Plateforme de Gestion de Projets Collaboratifs**, réalisé dans le cadre de la SAE301 (BUT MMI 2).

L'objectif principal est de développer une **application web complète** permettant aux équipes de gérer leurs projets de manière intuitive. La plateforme offre la création de projets, l'assignation de tâches, le suivi en temps réel et un système d'authentification sécurisé. Elle cible les petites équipes et les startups cherchant une alternative légère aux outils existants.

---

## 2. Problèmes rencontrés et solutions apportées

### Problème 1 – Synchronisation des données en temps réel entre les utilisateurs

- **Contexte :**  
  Plusieurs utilisateurs accédaient simultanément au même projet. Les modifications d'une personne n'étaient pas immédiatement visibles aux autres, causant des conflits de données et une mauvaise expérience utilisateur.

- **Problème :**  
  Sans système de notification ou de mise à jour automatique, les utilisateurs devaient rafraîchir manuellement la page pour voir les changements. Cela a créé une frustation importante lors des tests en groupe.

- **Solution :**  
  Implémentation d'un système de **polling AJAX** qui vérifie les mises à jour toutes les 2 secondes. À terme, nous envisageons de migrer vers **WebSockets** pour une véritable synchronisation temps réel.

### Problème 2 – Gestion de la authentification et des permissions utilisateur

- **Contexte :**  
  Différents rôles d'utilisateurs (administrateur, responsable de projet, contributeur) devaient avoir des permissions différentes sur les tâches et projets.

- **Problème :**  
  Initialement, toutes les routes étaient accessibles sans vérification de droits. Cela posait un risque de sécurité : n'importe quel utilisateur pouvait modifier ou supprimer les projets d'autres personnes.

- **Solution :**  
  Création d'un **middleware d'authentification** (JWT tokens) et d'un système de **vérification de permissions** avant chaque action sensible. Les rôles sont stockés en base de données et vérifiés côté serveur.

### Problème 3 – Performance de la base de données avec les requêtes complexes

- **Contexte :**  
  Lors du chargement d'un projet avec toutes ses tâches, utilisateurs et commentaires, les requêtes SQL généraient plusieurs jointures complexes, ralentissant l'affichage de la page.

- **Problème :**  
  Le chargement d'une page projet prenait **3–4 secondes**, créant une mauvaise expérience utilisateur. De plus, les N+1 queries rendaient la base de données inefficace.

- **Solution :**  
  Optimisation des requêtes avec des **jointures préparées**, mise en place d'un **système de cache** (Redis), et utilisation de **pagination** pour limiter les données retournées. Résultat : chargement en **< 500ms**.

### Problème 4 – Intégration du design Figma en HTML/CSS

- **Contexte :**  
  La maquette Figma proposait un design moderne avec des animations complexes et une palette de couleurs très spécifique.

- **Problème :**  
  Convertir exactement la maquette en code front était chronophage. Les espacements, typographies et animations n'étaient pas précis, créant une différence entre le design et la réalité.

- **Solution :**  
  Création d'un **système de variables CSS personnalisées** (custom properties) regroupant toutes les couleurs, tailles et espacements. Utilisation de **SCSS** pour moduler le code et réduire la duplication. Animations CSS préfabriquées pour les microinteractions courantes.

### Problème 5 – Gestion des erreurs et validation des formulaires

- **Contexte :**  
  Les données envoyées depuis le front-end n'étaient pas validées côté serveur, permettant l'envoi de données incohérentes ou malveillantes.

- **Problème :**  
  Risques de sécurité (injection SQL, XSS) et crashes serveur lors de données malformées. Pas de feedback utilisateur clair en cas d'erreur.

- **Solution :**  
  Mise en place d'une **validation front-end** avec des règles clientes (HTML5 + JavaScript), doublée d'une **validation serveur rigoureuse** avec la librairie **express-validator**. Messages d'erreur personnalisés affichés à l'utilisateur.

---

## 3. Technologies, extensions et modules utilisés

### 3.1. Langages et frameworks

- **Front-end :**

  - HTML5 / CSS3 (SCSS)
  - JavaScript vanilla
  - Petite utilisation de jQuery pour les animations et manipulations du DOM
  - Responsive design (Mobile First)

- **Back-end :**

  - Node.js (v16+)
  - Express.js 4.x – serveur HTTP
  - EJS – templating côté serveur

- **Base de données :**
  - MySQL 8.0
  - Outil de gestion : phpMyAdmin

### 3.2. Modules et dépendances

{
"dependencies": {
"express": "^4.18.2",
"ejs": "^3.1.9",
"mysql2": "^3.6.0",
"dotenv": "^16.3.1",
"bcryptjs": "^2.4.3",
"jsonwebtoken": "^9.1.0",
"express-validator": "^7.0.1",
"cors": "^2.8.5",
"multer": "^1.4.5-lts.1"
},
"devDependencies": {
"nodemon": "^3.0.1",
"eslint": "^8.52.0",
"prettier": "^3.0.3"
}
}

- **express** – serveur HTTP et gestion des routes
- **ejs** – templates pour le rendu côté serveur
- **mysql2** – connecteur MySQL avec support des promises
- **dotenv** – gestion des variables d'environnement
- **bcryptjs** – hachage sécurisé des mots de passe
- **jsonwebtoken (JWT)** – authentification par tokens
- **express-validator** – validation des données en entrée
- **cors** – gestion des Cross-Origin Requests
- **multer** – gestion des uploads de fichiers
- **nodemon** – rechargement automatique en développement


## 4. Tableau récapitulatif des contributions

| Fonctionnalité principale           | Description rapide                                               | Mayol | Louanne | Noé | Quentin |
|-------------------------------------|------------------------------------------------------------------|-------|---------|-----|---------|
| Conception UX / UI                  | Maquettes, hiérarchie visuelle, cohérence graphique             | 15 %  | 15 %    | 35 % | 35 %   |
| Intégration front-end (HTML/CSS/JS) | Intégration des vues, responsive, interactions, animations      | 10 %  | 10 %    | 40 % | 40 %   |
| Développement back-end (API/logic)  | Routes, contrôleurs, logique métier, gestion des erreurs        | 35 %  | 35 %    | 15 % | 15 %   |
| Authentification & sessions         | Connexion, inscription, gestion des droits, sécurité            | 40 %  | 40 %    | 10 % | 10 %   |
| Base de données                     | Modélisation, schéma, requêtes, migrations éventuelles          | 30 %  | 30 %    | 20 % | 20 %   |
| Gestion des tâches / projets        | CRUD, filtres, tri, recherche                                   | 30 %  | 30 %    | 20 % | 20 %   |
| Interface utilisateur avancée       | Composants interactifs, feedback visuel, micro-interactions     | 10 %  | 10 %    | 40 % | 40 %   |
| Tests et débogage                   | Recettes, correction de bugs, validation des fonctionnalités    | 25 %  | 25 %    | 25 % | 25 %   |
| Documentation et organisation       | README, suivi GitHub, gestion des issues / branches             | 25 %  | 25 %    | 25 % | 25 %   |
| **TOTAL par membre**                |                                                                  | **26 %** | **26 %** | **25 %** | **25 %** |

---

## 5. Résumé des rôles principaux

### 🧑‍💻 Mayol
- Principalement **back-end**
- Mise en place des routes, contrôleurs et logique métier
- Participation à la conception de la base de données
- Contribution à l’authentification et à la gestion des sessions

### 👩‍💻 Louanne
- Principalement **back-end**
- Implémentation des fonctionnalités serveur (CRUD, gestion des erreurs)
- Participation à l’architecture de l’API et des modèles
- Support ponctuel sur l’intégration front-end

### 🧑‍🎨 Noé
- Principalement **front-end**
- Intégration des maquettes (HTML/CSS/JS), responsive
- Mise en place des interactions utilisateur et de l’ergonomie
- Ajustements visuels et cohérence graphique

### 🧑‍🎨 Quentin
- Principalement **front-end**
- Intégration des pages et composants UI
- Gestion des comportements dynamiques côté client
- Participation aux tests, corrections visuelles et retours UX
