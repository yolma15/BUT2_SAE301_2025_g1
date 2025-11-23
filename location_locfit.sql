-- Suppression des tables si elles existent déjà
DROP TABLE IF EXISTS `location`;
DROP TABLE IF EXISTS `produit`;
DROP TABLE IF EXISTS `utilisateur`;

-- Création de la table utilisateur avec colonne img
CREATE TABLE `utilisateur` (
  `id` INTEGER PRIMARY KEY AUTO_INCREMENT,
  `login` VARCHAR(50) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `nom` VARCHAR(50) NOT NULL,
  `prenom` VARCHAR(50) NOT NULL,
  `ddn` DATE NOT NULL,
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `type_utilisateur` VARCHAR(10) NOT NULL,
  `img` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_login (`login`),
  INDEX idx_type (`type_utilisateur`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Création de la table produit
CREATE TABLE `produit` (
  `id` INTEGER PRIMARY KEY AUTO_INCREMENT,
  `type` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `marque` VARCHAR(100) NOT NULL,
  `modele` VARCHAR(100) NOT NULL,
  `prix_location` DECIMAL(10, 2) NOT NULL,
  `etat` VARCHAR(20) NOT NULL DEFAULT 'disponible',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_etat (`etat`),
  INDEX idx_type (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Création de la table location
CREATE TABLE `location` (
  `id` INTEGER PRIMARY KEY AUTO_INCREMENT,
  `date_debut` DATE NOT NULL,
  `date_retour_prevue` DATE NOT NULL,
  `date_retour_effective` DATE DEFAULT NULL,
  `prix_total` DECIMAL(10, 2) NOT NULL,
  `utilisateur_id` INTEGER NOT NULL,
  `produit_id` INTEGER NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_utilisateur (`utilisateur_id`),
  INDEX idx_produit (`produit_id`),
  INDEX idx_dates (`date_debut`, `date_retour_prevue`),
  CONSTRAINT fk_location_utilisateur FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur` (`id`) ON DELETE CASCADE,
  CONSTRAINT fk_location_produit FOREIGN KEY (`produit_id`) REFERENCES `produit` (`id`) ON DELETE CASCADE,
  CONSTRAINT chk_dates CHECK (`date_retour_prevue` >= `date_debut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
