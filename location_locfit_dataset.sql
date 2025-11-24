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

