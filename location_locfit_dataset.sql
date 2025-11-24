INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) 
VALUES 
("jdupont", "81dc9bdb52d04dc20036dbd8313ed055", "Dupont", "Jean", '1990-05-12', "jdupont@example.com", "client"),
("sleclerc", "81dc9bdb52d04dc20036dbd8313ed055", "Leclerc", "Sophie", '1985-09-21', "sleclerc@example.com", "client"),
("plefebvre", "81dc9bdb52d04dc20036dbd8313ed055", "Lefebvre", "Pierre", '1988-12-05', "plefebvre@example.com", "client"),
("mleroy", "81dc9bdb52d04dc20036dbd8313ed055", "Leroy", "Marie", '1995-07-18', "mleroy@example.com", "client"),
("amartin", "81dc9bdb52d04dc20036dbd8313ed055", "Martin", "Alex", '1982-03-28', "amartin@example.com", "agent"),
("lpetit", "81dc9bdb52d04dc20036dbd8313ed055", "Petit", "Laura", '1989-11-15', "lpetit@example.com", "agent"),
("adufrene", "81dc9bdb52d04dc20036dbd8313ed055", "Dufrène", "Alice", '1975-01-01', "adufrene@example.com", "admin");

-- Ajout de la colonne img à la table utilisateur
ALTER TABLE utilisateur 
ADD COLUMN img VARCHAR(255) DEFAULT NULL AFTER email;

ALTER TABLE produit 
ADD COLUMN img VARCHAR(255) DEFAULT NULL ;

INSERT INTO location (date_debut, date_retour_prevue, date_retour_effective, prix_total, utilisateur_id, produit_id) VALUES
('2025-01-03', '2025-01-06', '2025-01-06', 45.00, 3, 12),
('2025-01-05', '2025-01-08', NULL, 39.00, 7, 4),
('2025-01-09', '2025-01-11', '2025-01-10', 22.00, 5, 9),
('2025-01-12', '2025-01-15', '2025-01-15', 60.00, 2, 6),
('2025-01-14', '2025-01-17', NULL, 48.00, 1, 2),
('2025-01-18', '2025-01-21', '2025-01-20', 31.00, 4, 11),
('2025-01-20', '2025-01-23', '2025-01-22', 27.00, 6, 5),
('2025-01-22', '2025-01-25', NULL, 66.00, 7, 13),
('2025-01-25', '2025-01-28', '2025-01-28', 54.00, 3, 3),
('2025-01-27', '2025-01-30', '2025-01-29', 33.00, 2, 8),
('2025-02-01', '2025-02-04', NULL, 51.00, 1, 10),
('2025-02-03', '2025-02-06', '2025-02-05', 42.00, 4, 1),
('2025-02-05', '2025-02-08', '2025-02-08', 58.00, 6, 15),
('2025-02-08', '2025-02-10', NULL, 19.00, 5, 7),
('2025-02-09', '2025-02-12', '2025-02-12', 73.00, 3, 4),
('2025-02-11', '2025-02-14', NULL, 29.00, 7, 9),
('2025-02-14', '2025-02-17', '2025-02-16', 36.00, 2, 5),
('2025-02-15', '2025-02-18', NULL, 62.00, 1, 11),
('2025-02-17', '2025-02-20', '2025-02-20', 44.00, 4, 2),
('2025-02-20', '2025-02-23', '2025-02-22', 53.00, 6, 3),
('2025-02-21', '2025-02-24', NULL, 40.00, 5, 6),
('2025-02-23', '2025-02-26', '2025-02-25', 37.00, 7, 4),
('2025-02-25', '2025-02-28', NULL, 28.00, 3, 12),
('2025-02-26', '2025-03-01', '2025-03-01', 77.00, 2, 10),
('2025-03-01', '2025-03-04', NULL, 33.00, 1, 8),
('2025-03-02', '2025-03-05', '2025-03-05', 59.00, 4, 15),
('2025-03-04', '2025-03-07', '2025-03-07', 21.00, 6, 1),
('2025-03-06', '2025-03-09', NULL, 49.00, 5, 13),
('2025-03-07', '2025-03-10', '2025-03-10', 35.00, 7, 6),
('2025-03-10', '2025-03-13', NULL, 63.00, 3, 3);



INSERT INTO produit (type, description, marque, modele, prix_location, etat, img) VALUES
('Vélo', 'Vélo tout terrain adulte suspension avant', 'Rockrider', 'ST 540', 18.00, 'bon', 'img/velo1.jpg'),
('Vélo', 'Vélo route carbone léger performance', 'Triban', 'RC 520', 22.00, 'bon', 'img/velo2.jpg'),
('VTT', 'VTT descente cadre aluminium freins hydrauliques', 'Scott', 'Genius 730', 25.00, 'bon', 'img/vtt1.jpg'),
('Ski', 'Pack skis + fixations piste intermédiaire', 'Rossignol', 'React R6', 20.00, 'bon', 'img/ski1.jpg'),
('Ski', 'Skis freeride large polyvalent neige profonde', 'Salomon', 'QST 92', 24.00, 'neuf', 'img/ski2.jpg'),
('Snowboard', 'Planche freestyle twin tip', 'Burton', 'Custom', 23.00, 'bon', 'img/snow1.jpg'),
('Raquette', 'Raquette de tennis adulte graphite', 'Wilson', 'Blade 98', 8.00, 'neuf', 'img/raquette1.jpg'),
('Raquette', 'Raquette badminton légère débutant', 'Yonex', 'Astrox 22', 6.00, 'bon', 'img/raquette2.jpg'),
('Surf', 'Planche de surf mousse 8 pieds', 'Olaian', '500 Soft', 15.00, 'bon', 'img/surf1.jpg'),
('Surf', 'Shortboard performance 6.2', 'Quiksilver', 'Pyzel Shadow', 18.00, 'usé', 'img/surf2.jpg'),
('Canoë', 'Canoë biplace rigide avec pagaies', 'RTM', 'Brio', 30.00, 'bon', 'img/canoe1.jpg'),
('Kayak', 'Kayak gonflable 1 place rivière calme', 'Itiwit', 'X100', 14.00, 'neuf', 'img/kayak1.jpg'),
('Roller', 'Roller adulte street aluminium', 'Oxelo', 'MF500', 10.00, 'bon', 'img/roller1.jpg'),
('Tente', 'Tente 3 places montage rapide', 'Quechua', '2 Seconds', 12.00, 'bon', 'img/tente1.jpg'),
('Tente', 'Tente 6 places familiale spacieuse', 'Coleman', 'Octagon', 18.00, 'bon', 'img/tente2.jpg'),
('Escalade', 'Chaussures escalade adhérence forte', 'La Sportiva', 'Solution', 7.00, 'bon', 'img/climb1.jpg'),
('Escalade', 'Baudrier escalade polyvalent adulte', 'Petzl', 'Corax', 6.00, 'neuf', 'img/baudrier1.jpg'),
('Plongée', 'Combinaison néoprène 5mm', 'Cressi', 'Endurance', 12.00, 'usé', 'img/plongee1.jpg'),
('Stand Up Paddle', 'SUP gonflable 10.6 tout public', 'Red Paddle', 'Ride', 20.00, 'bon', 'img/sup1.jpg'),
('Trotinette', 'Trottinette freestyle robuste', 'Blunt', 'Colt S4', 9.00, 'bon', 'img/trott1.jpg');
