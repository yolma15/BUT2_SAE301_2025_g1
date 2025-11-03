CREATE TABLE `utilisateur` (
  `id` INTEGER PRIMARY KEY AUTO_INCREMENT,
  `login` VARCHAR(50) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `nom` VARCHAR(50) NOT NULL,
  `prenom` VARCHAR(50) NOT NULL,
  `ddn` DATE NOT NULL,
  `email` VARCHAR(50) UNIQUE NOT NULL,
  `type_utilisateur` VARCHAR(10) NOT NULL
);

CREATE TABLE `location` (
  `id` INTEGER PRIMARY KEY AUTO_INCREMENT,
  `date_debut` DATE NOT NULL,
  `date_retour_prevue` DATE NOT NULL,
  `date_retour_effective` DATE,
  `prix_total` FLOAT,
  `utilisateur_id` INTEGER NOT NULL,
  `produit_id` INTEGER NOT NULL
);

CREATE TABLE `produit` (
  `id` INTEGER PRIMARY KEY AUTO_INCREMENT,
  `type` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255),
  `marque` VARCHAR(100) NOT NULL,
  `modele` VARCHAR(100) NOT NULL,
  `prix_location` FLOAT NOT NULL,
  `etat` VARCHAR(20) NOT NULL
);

ALTER TABLE `location` ADD FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur` (`id`);

ALTER TABLE `location` ADD FOREIGN KEY (`produit_id`) REFERENCES `produit` (`id`);