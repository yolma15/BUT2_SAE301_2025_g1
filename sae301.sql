-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : ven. 28 nov. 2025 à 16:22
-- Version du serveur : 9.1.0
-- Version de PHP : 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `sae301`
--

-- --------------------------------------------------------

--
-- Structure de la table `location`
--

DROP TABLE IF EXISTS `location`;
CREATE TABLE IF NOT EXISTS `location` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date_debut` date NOT NULL,
  `date_retour_prevue` date NOT NULL,
  `date_retour_effective` date DEFAULT NULL,
  `prix_total` float DEFAULT NULL,
  `utilisateur_id` int NOT NULL,
  `produit_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`),
  KEY `produit_id` (`produit_id`)
) ENGINE=MyISAM AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `location`
--

INSERT INTO `location` (`id`, `date_debut`, `date_retour_prevue`, `date_retour_effective`, `prix_total`, `utilisateur_id`, `produit_id`) VALUES
(1, '2025-01-03', '2025-01-06', '2025-01-06', 45, 3, 12),
(2, '2025-01-05', '2025-01-08', NULL, 39, 7, 4),
(3, '2025-01-09', '2025-01-11', '2025-01-10', 22, 5, 9),
(4, '2025-01-12', '2025-01-15', '2025-01-15', 60, 2, 6),
(5, '2025-01-14', '2025-01-17', NULL, 48, 1, 2),
(6, '2025-01-18', '2025-01-21', '2025-01-20', 31, 4, 11),
(7, '2025-01-20', '2025-01-23', '2025-01-22', 27, 6, 5),
(8, '2025-01-22', '2025-01-25', NULL, 66, 7, 13),
(9, '2025-01-25', '2025-01-28', '2025-01-28', 54, 3, 3),
(10, '2025-01-27', '2025-01-30', '2025-01-29', 33, 2, 8),
(11, '2025-02-01', '2025-02-04', NULL, 51, 1, 10),
(12, '2025-02-03', '2025-02-06', '2025-02-05', 42, 4, 1),
(13, '2025-02-05', '2025-02-08', '2025-02-08', 58, 6, 15),
(14, '2025-02-08', '2025-02-10', NULL, 19, 5, 7),
(15, '2025-02-09', '2025-02-12', '2025-02-12', 73, 3, 4),
(16, '2025-02-11', '2025-02-14', NULL, 29, 7, 9),
(17, '2025-02-14', '2025-02-17', '2025-02-16', 36, 2, 5),
(18, '2025-02-15', '2025-02-18', NULL, 62, 1, 11),
(19, '2025-02-17', '2025-02-20', '2025-02-20', 44, 4, 2),
(20, '2025-02-20', '2025-02-23', '2025-02-22', 53, 6, 3),
(21, '2025-02-21', '2025-02-24', NULL, 40, 5, 6),
(22, '2025-02-23', '2025-02-26', '2025-02-25', 37, 7, 4),
(23, '2025-02-25', '2025-02-28', NULL, 28, 3, 12),
(24, '2025-02-26', '2025-03-01', '2025-03-01', 77, 2, 10),
(25, '2025-03-01', '2025-03-04', NULL, 33, 1, 8),
(26, '2025-03-02', '2025-03-05', '2025-03-05', 59, 4, 15),
(27, '2025-03-04', '2025-03-07', '2025-03-07', 21, 6, 1),
(28, '2025-03-06', '2025-03-09', '2025-11-28', 51, 5, 13),
(29, '2025-03-07', '2025-03-10', '2025-03-10', 35, 7, 6),
(30, '2025-03-10', '2025-03-13', '2025-11-28', 68, 3, 3);

-- --------------------------------------------------------

--
-- Structure de la table `produit`
--

DROP TABLE IF EXISTS `produit`;
CREATE TABLE IF NOT EXISTS `produit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `marque` varchar(100) NOT NULL,
  `modele` varchar(100) NOT NULL,
  `prix_location` float NOT NULL,
  `etat` varchar(20) NOT NULL,
  `img` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `produit`
--

INSERT INTO `produit` (`id`, `type`, `description`, `marque`, `modele`, `prix_location`, `etat`, `img`) VALUES
(1, 'Vélo', 'Vélo tout terrain adulte suspension avant', 'Rockrider', 'ST 540', 18, 'bon', 'img/velo1.jpg'),
(2, 'Vélo', 'Vélo route carbone léger performance', 'Triban', 'RC 520', 22, 'bon', 'img/velo2.jpg'),
(3, 'VTT', 'VTT descente cadre aluminium freins hydrauliques', 'Scott', 'Genius 730', 25, 'disponible', 'img/vtt1.jpg'),
(4, 'Ski', 'Pack skis + fixations piste intermédiaire', 'Rossignol', 'React R6', 20, 'bon', 'img/ski1.jpg'),
(5, 'Ski', 'Skis freeride large polyvalent neige profonde', 'Salomon', 'QST 92', 24, 'neuf', 'img/ski2.jpg'),
(6, 'Snowboard', 'Planche freestyle twin tip', 'Burton', 'Custom', 23, 'bon', 'img/snow1.jpg'),
(7, 'Raquette', 'Raquette de tennis adulte graphite', 'Wilson', 'Blade 98', 8, 'neuf', 'img/raquette1.jpg'),
(8, 'Raquette', 'Raquette badminton légère débutant', 'Yonex', 'Astrox 22', 6, 'bon', 'img/raquette2.jpg'),
(9, 'Surf', 'Planche de surf mousse 8 pieds', 'Olaian', '500 Soft', 15, 'bon', 'img/surf1.jpg'),
(10, 'Surf', 'Shortboard performance 6.2', 'Quiksilver', 'Pyzel Shadow', 18, 'usé', 'img/surf2.jpg'),
(11, 'Canoë', 'Canoë biplace rigide avec pagaies', 'RTM', 'Brio', 30, 'bon', 'img/canoe1.jpg'),
(12, 'Kayak', 'Kayak gonflable 1 place rivière calme', 'Itiwit', 'X100', 14, 'neuf', 'img/kayak1.jpg'),
(13, 'Roller', 'Roller adulte street aluminium', 'Oxelo', 'MF500', 10, 'disponible', 'img/roller1.jpg'),
(14, 'Tente', 'Tente 3 places montage rapide', 'Quechua', '2 Seconds', 12, 'bon', 'img/tente1.jpg'),
(15, 'Tente', 'Tente 6 places familiale spacieuse', 'Coleman', 'Octagon', 18, 'bon', 'img/tente2.jpg'),
(16, 'Escalade', 'Chaussures escalade adhérence forte', 'La Sportiva', 'Solution', 7, 'bon', 'img/climb1.jpg'),
(17, 'Escalade', 'Baudrier escalade polyvalent adulte', 'Petzl', 'Corax', 6, 'neuf', 'img/baudrier1.jpg'),
(18, 'Plongée', 'Combinaison néoprène 5mm', 'Cressi', 'Endurance', 12, 'usé', 'img/plongee1.jpg'),
(19, 'Stand Up Paddle', 'SUP gonflable 10.6 tout public', 'Red Paddle', 'Ride', 20, 'bon', 'img/sup1.jpg'),
(20, 'Trotinette', 'Trottinette freestyle robuste', 'Blunt', 'Colt S4', 9, 'bon', 'img/trott1.jpg');

-- --------------------------------------------------------

--
-- Structure de la table `utilisateur`
--

DROP TABLE IF EXISTS `utilisateur`;
CREATE TABLE IF NOT EXISTS `utilisateur` (
  `id` int NOT NULL AUTO_INCREMENT,
  `login` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nom` varchar(50) NOT NULL,
  `prenom` varchar(50) NOT NULL,
  `ddn` date NOT NULL,
  `email` varchar(50) NOT NULL,
  `img` varchar(255) DEFAULT NULL,
  `type_utilisateur` varchar(10) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `login` (`login`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `utilisateur`
--

INSERT INTO `utilisateur` (`id`, `login`, `password`, `nom`, `prenom`, `ddn`, `email`, `img`, `type_utilisateur`) VALUES
(1, 'jdupont', '$2b$10$e.b7wEgqP1IxoNzuAQOLhu/xc64BGbtEjFJ97onBL0GnGhlKWZgzG', 'Dupont', 'Jean', '1990-05-11', 'jdupont@example.com', NULL, 'client'),
(2, 'sleclerc', '81dc9bdb52d04dc20036dbd8313ed055', 'Leclerc', 'Sophie', '1985-09-21', 'sleclerc@example.com', NULL, 'client'),
(3, 'plefebvre', '81dc9bdb52d04dc20036dbd8313ed055', 'Lefebvre', 'Pierre', '1988-12-05', 'plefebvre@example.com', NULL, 'client'),
(4, 'mleroy', '81dc9bdb52d04dc20036dbd8313ed055', 'Leroy', 'Marie', '1995-07-18', 'mleroy@example.com', NULL, 'client'),
(5, 'amartin', '$2b$10$81kAT0s.wtEZ1i3G.aU7ne3mfecihNmrcVmp0792hjgss0BqZEg/W', 'Martin', 'Alex', '1982-03-28', 'amartin@example.com', NULL, 'agent'),
(6, 'lpetit', '81dc9bdb52d04dc20036dbd8313ed055', 'Petit', 'Laura', '1989-11-15', 'lpetit@example.com', NULL, 'agent'),
(7, 'adufrene', '$2b$10$vI/SAFGV/yaiEP.qMYXnWej9NFYGrqZcUb1heGZ3IKc82aDI6y.za', 'Dufrène', 'Alice', '1975-01-01', 'adufrene@example.com', NULL, 'admin');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
