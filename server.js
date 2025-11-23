import express from "express";
import path from "path";
import session from "express-session";
import bcrypt from "bcrypt";
import pool from "./db.js";

const app = express();

// Configuration moteur de template
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

// Middleware de base
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gestion de session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "CHANGE_ME_IN_PRODUCTION",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 heures
    },
  })
);

// Expose session data to EJS views
app.use((req, res, next) => {
  res.locals.isLoggedIn = Boolean(req.session?.userId);
  res.locals.userRole = req.session?.userRole || null;
  res.locals.username = req.session?.username || null;
  res.locals.userImg = req.session?.userImg || null;
  res.locals.message = null;
  next();
});

// ============================================
// MIDDLEWARES D'AUTHENTIFICATION
// ============================================

function authMiddleware(req, res, next) {
  if (req.session?.userId) return next();
  req.session.postLoginRedirect = req.originalUrl;
  return res.redirect("/login");
}

function isAdmin(req, res, next) {
  if (req.session?.userRole === "admin") return next();
  return res.status(403).render("error", {
    message: "Accès réservé aux administrateurs",
    code: 403,
  });
}

function isAgent(req, res, next) {
  if (req.session?.userRole === "agent" || req.session?.userRole === "admin") {
    return next();
  }
  return res.status(403).render("error", {
    message: "Accès réservé aux agents",
    code: 403,
  });
}

function isClient(req, res, next) {
  if (req.session?.userRole === "client") return next();
  return res.status(403).render("error", {
    message: "Accès réservé aux clients",
    code: 403,
  });
}

// ============================================
// ROUTES PUBLIQUES
// ============================================

app.get("/", (req, res) => res.render("home"));
app.get("/home", (req, res) => res.render("home"));

// Page de connexion
app.get("/login", (req, res) => {
  if (req.session?.userId) return res.redirect("/home");
  res.render("login", { message: null });
});

// Page d'inscription
app.get("/register", (req, res) => {
  if (req.session?.userId) return res.redirect("/home");
  res.render("register", { message: null });
});

// Catalogue produits (accessible à tous)
app.get("/catalogue", async (req, res) => {
  try {
    const [produits] = await pool.query(
      "SELECT * FROM produit WHERE etat != 'supprimé' ORDER BY id DESC"
    );
    res.render("catalogue", { produits });
  } catch (err) {
    console.error("Erreur récupération produits :", err);
    res.status(500).render("catalogue", {
      produits: [],
      message: "Erreur lors du chargement des produits",
    });
  }
});

// Détail d'un produit
app.get("/product/:id", async (req, res) => {
  try {
    const [produits] = await pool.query("SELECT * FROM produit WHERE id = ?", [
      req.params.id,
    ]);

    if (produits.length === 0) {
      return res.status(404).render("404");
    }

    res.render("product", { produit: produits[0] });
  } catch (err) {
    console.error("Erreur récupération produit :", err);
    res.status(500).render("error", {
      message: "Erreur lors du chargement du produit",
      code: 500,
    });
  }
});

// ============================================
// ROUTES AUTHENTIFICATION
// ============================================

// Inscription
app.post("/register", async (req, res) => {
  const { login, password, nom, prenom, ddn, email } = req.body;

  // Validation complète
  if (!login || !password || !nom || !prenom || !ddn || !email) {
    return res.render("register", {
      message: "Tous les champs sont requis",
    });
  }

  // Validation format email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.render("register", {
      message: "Format d'email invalide",
    });
  }

  // Validation longueur mot de passe
  if (password.length < 8) {
    return res.render("register", {
      message: "Le mot de passe doit contenir au moins 8 caractères",
    });
  }

  // Validation date de naissance
  const dateNaissance = new Date(ddn);
  const aujourdhui = new Date();
  const age = aujourdhui.getFullYear() - dateNaissance.getFullYear();
  const moisDiff = aujourdhui.getMonth() - dateNaissance.getMonth();
  const jourDiff = aujourdhui.getDate() - dateNaissance.getDate();

  // Ajustement si l'anniversaire n'est pas encore passé cette année
  const ageAjuste = (moisDiff < 0 || (moisDiff === 0 && jourDiff < 0)) ? age - 1 : age;

  if (ageAjuste < 18) {
    return res.render("register", {
      message: "Vous devez avoir au moins 18 ans pour vous inscrire",
    });
  }

  try {
    // Utilisation de bcrypt pour la sécurité (recommandé)
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, ?, ?, ?, ?, ?, 'client')",
      [login, hashedPassword, nom, prenom, ddn, email]
    );

    res.render("login", {
      message: "Inscription réussie ! Vous pouvez maintenant vous connecter.",
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.render("register", {
        message: "Ce login ou cet email est déjà utilisé",
      });
    }
    console.error("Erreur inscription :", error);
    res.status(500).render("register", {
      message: "Erreur serveur lors de l'inscription",
    });
  }
});

// Connexion
app.post("/login", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.render("login", {
      message: "Veuillez saisir vos identifiants",
    });
  }

  try {
    // Récupération de l'utilisateur avec l'image
    const [results] = await pool.query(
      "SELECT id, login, nom, prenom, type_utilisateur, password, img FROM utilisateur WHERE login = ?",
      [login]
    );

    if (results.length === 0) {
      return res.render("login", {
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    const user = results[0];

    // Vérification du mot de passe avec bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.render("login", {
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    // Création de la session
    req.session.userId = user.id;
    req.session.userRole = user.type_utilisateur;
    req.session.username = user.prenom || user.login;
    req.session.userImg = user.img;
    req.session.loggedin = true;

    const nextUrl = req.session.postLoginRedirect || "/home";
    delete req.session.postLoginRedirect;

    return res.redirect(nextUrl);
  } catch (error) {
    console.error("Erreur login :", error);
    return res.status(500).render("login", {
      message: "Erreur interne du serveur",
    });
  }
});

// Déconnexion
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Erreur destruction session :", err);
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

// ============================================
// ROUTES CLIENT
// ============================================

// Mes locations
app.get("/mes-locations", authMiddleware, isClient, async (req, res) => {
  try {
    const [locations] = await pool.query(
      `SELECT l.*, p.type, p.marque, p.modele, p.prix_location 
       FROM location l
       JOIN produit p ON l.produit_id = p.id
       WHERE l.utilisateur_id = ?
       ORDER BY l.date_debut DESC`,
      [req.session.userId]
    );

    res.render("mes_locations", { locations });
  } catch (err) {
    console.error("Erreur récupération locations :", err);
    res.status(500).render("mes_locations", {
      locations: [],
      message: "Erreur lors du chargement de vos locations",
    });
  }
});

// Profil client (GET: Afficher)
app.get("/profil", authMiddleware, isClient, async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT id, login, nom, prenom, ddn, email, img FROM utilisateur WHERE id = ?",
      [req.session.userId]
    );

    if (users.length === 0) {
      return res.redirect("/logout");
    }

    // Récupération du message de succès/erreur depuis la query string
    let profilMessage = null;
    const msgType = req.query.message;

    if (msgType === "success_info") {
      profilMessage = {
        type: "success",
        text: "Informations mises à jour avec succès.",
      };
    } else if (msgType === "error_info") {
      profilMessage = {
        type: "error",
        text: "Erreur lors de la mise à jour des informations.",
      };
    } else if (msgType === "success_mdp") {
      profilMessage = { type: "success", text: "Mot de passe changé avec succès." };
    } else if (msgType === "error_mdp") {
      profilMessage = {
        type: "error",
        text: "Erreur lors du changement de mot de passe.",
      };
    } else if (msgType === "mdp_mismatch") {
      profilMessage = { type: "error", text: "Ancien mot de passe incorrect." };
    } else if (msgType === "new_mdp_mismatch") {
      profilMessage = {
        type: "error",
        text: "Les nouveaux mots de passe ne correspondent pas.",
      };
    } else if (msgType === "missing_fields") {
      profilMessage = {
        type: "error",
        text: "Veuillez remplir tous les champs du mot de passe.",
      };
    } else if (msgType === "same_password") {
      profilMessage = {
        type: "error",
        text: "Le nouveau mot de passe doit être différent de l'ancien.",
      };
    }

    res.render("profil", { utilisateur: users[0], message: profilMessage });
  } catch (err) {
    console.error("Erreur chargement profil :", err);
    res.status(500).render("error", {
      message: "Erreur lors du chargement du profil",
      code: 500,
    });
  }
});

// Profil client (POST - modification des informations)
app.post("/profil/informations", authMiddleware, isClient, async (req, res) => {
  const { email, nom, prenom, ddn } = req.body;

  if (!email || !nom || !prenom || !ddn) {
    return res.json({ success: false, error: "Tous les champs sont requis." });
  }

  // Validation format email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.json({ success: false, error: "Format d'email invalide." });
  }

  try {
    await pool.query(
      "UPDATE utilisateur SET email = ?, nom = ?, prenom = ?, ddn = ? WHERE id = ?",
      [email, nom, prenom, ddn, req.session.userId]
    );

    // Mise à jour du nom d'utilisateur en session
    req.session.username = prenom;

    return res.json({ success: true });
  } catch (err) {
    console.error("Erreur update profil :", err);
    // Vérification si l'email existe déjà
    if (err.code === "ER_DUP_ENTRY") {
      return res.json({ success: false, error: "Cet email est déjà utilisé." });
    }
    return res.json({ success: false, error: "Erreur lors de la mise à jour." });
  }
});

// Changement de mot de passe
app.post("/profil/password", authMiddleware, isClient, async (req, res) => {
  const userId = req.session.userId;
  const { ancien_mdp, nouveau_mdp, confirmer_mdp } = req.body;

  // 1. Vérification des champs
  if (!ancien_mdp || !nouveau_mdp || !confirmer_mdp) {
    return res.json({
      success: false,
      error: "Veuillez remplir tous les champs du mot de passe.",
    });
  }

  // 2. Vérification que les nouveaux mots de passe correspondent
  if (nouveau_mdp !== confirmer_mdp) {
    return res.json({
      success: false,
      error: "Les nouveaux mots de passe ne correspondent pas.",
    });
  }

  // 3. Empêcher de mettre le même mot de passe
  if (ancien_mdp === nouveau_mdp) {
    return res.json({
      success: false,
      error: "Le nouveau mot de passe doit être différent de l'ancien.",
    });
  }

  // 4. Validation longueur
  if (nouveau_mdp.length < 8) {
    return res.json({
      success: false,
      error: "Le mot de passe doit contenir au moins 8 caractères.",
    });
  }

  try {
    // 5. Récupération du hash actuel
    const [users] = await pool.query(
      "SELECT password FROM utilisateur WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.json({ success: false, error: "Utilisateur introuvable." });
    }

    // 6. Vérification de l'ancien mot de passe
    const passwordMatch = await bcrypt.compare(ancien_mdp, users[0].password);

    if (!passwordMatch) {
      return res.json({ success: false, error: "Ancien mot de passe incorrect." });
    }

    // 7. Hashage du nouveau mot de passe
    const newHashedPassword = await bcrypt.hash(nouveau_mdp, 10);

    // 8. Mise à jour avec le nouveau mot de passe
    const [updateResult] = await pool.query(
      "UPDATE utilisateur SET password = ? WHERE id = ?",
      [newHashedPassword, userId]
    );

    if (updateResult.affectedRows === 0) {
      return res.json({ success: false, error: "Erreur lors de la mise à jour." });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Erreur changement mot de passe :", err);
    return res.json({
      success: false,
      error: "Erreur lors du changement de mot de passe.",
    });
  }
});

// Créer une location
app.post("/locations/create", authMiddleware, isClient, async (req, res) => {
  const { produit_id, date_debut, date_retour_prevue } = req.body;

  if (!produit_id || !date_debut || !date_retour_prevue) {
    return res.status(400).json({
      error: "Tous les champs sont requis",
    });
  }

  // Validation des dates
  const debut = new Date(date_debut);
  const fin = new Date(date_retour_prevue);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);

  if (debut < aujourdhui) {
    return res.status(400).json({
      error: "La date de début ne peut pas être dans le passé",
    });
  }

  if (fin <= debut) {
    return res.status(400).json({
      error: "La date de retour doit être après la date de début",
    });
  }

  try {
    // Vérifier que le produit existe et est disponible
    const [produits] = await pool.query(
      "SELECT * FROM produit WHERE id = ? AND etat = 'disponible'",
      [produit_id]
    );

    if (produits.length === 0) {
      return res.status(400).json({
        error: "Produit non disponible",
      });
    }

    const produit = produits[0];

    // Calculer le prix total
    const nbJours = Math.ceil((fin - debut) / (1000 * 60 * 60 * 24));
    const prix_total = nbJours * produit.prix_location;

    // Créer la location
    await pool.query(
      "INSERT INTO location (date_debut, date_retour_prevue, prix_total, utilisateur_id, produit_id) VALUES (?, ?, ?, ?, ?)",
      [date_debut, date_retour_prevue, prix_total, req.session.userId, produit_id]
    );

    // Mettre à jour l'état du produit
    await pool.query("UPDATE produit SET etat = 'loué' WHERE id = ?", [produit_id]);

    res.json({ success: true, message: "Location créée avec succès" });
  } catch (err) {
    console.error("Erreur création location :", err);
    res.status(500).json({ error: "Erreur lors de la création de la location" });
  }
});

// Retour de produit
app.get("/returnprod", authMiddleware, isClient, (req, res) => {
  res.render("returnprod");
});

app.post("/returnprod", authMiddleware, isClient, async (req, res) => {
  const { location_id } = req.body;

  if (!location_id) {
    return res.status(400).json({ error: "ID de location requis" });
  }

  try {
    // Vérifier que la location appartient à l'utilisateur
    const [locations] = await pool.query(
      "SELECT * FROM location WHERE id = ? AND utilisateur_id = ?",
      [location_id, req.session.userId]
    );

    if (locations.length === 0) {
      return res.status(404).json({ error: "Location introuvable" });
    }

    const location = locations[0];

    // Vérifier que la location n'a pas déjà été retournée
    if (location.date_retour_effective) {
      return res.status(400).json({ error: "Ce produit a déjà été retourné" });
    }

    // Mettre à jour la location
    await pool.query(
      "UPDATE location SET date_retour_effective = NOW() WHERE id = ?",
      [location_id]
    );

    // Remettre le produit en disponible
    await pool.query("UPDATE produit SET etat = 'disponible' WHERE id = ?", [
      location.produit_id,
    ]);

    res.json({ success: true, message: "Retour enregistré avec succès" });
  } catch (err) {
    console.error("Erreur retour produit :", err);
    res.status(500).json({ error: "Erreur lors du retour" });
  }
});

// ============================================
// ROUTES AGENT
// ============================================

app.get("/locations", authMiddleware, isAgent, async (req, res) => {
  try {
    const [locations] = await pool.query(
      `SELECT l.*, u.nom, u.prenom, u.email, p.type, p.marque, p.modele
       FROM location l
       JOIN utilisateur u ON l.utilisateur_id = u.id
       JOIN produit p ON l.produit_id = p.id
       ORDER BY l.date_debut DESC`
    );

    res.render("locations", { locations });
  } catch (err) {
    console.error("Erreur récupération locations :", err);
    res.status(500).render("locations", {
      locations: [],
      message: "Erreur lors du chargement des locations",
    });
  }
});

// ============================================
// ROUTES ADMIN
// ============================================

// Page d'ajout de produit
app.get("/ajout_produit", authMiddleware, isAdmin, (req, res) => {
  res.render("ajout_produit", { message: null });
});

// Ajout de produit
app.post("/ajout_produit", authMiddleware, isAdmin, async (req, res) => {
  const { type, marque, modele, prix_location, description, etat } = req.body;

  if (!type || !marque || !modele || !prix_location || !etat) {
    return res.render("ajout_produit", {
      message: "Tous les champs obligatoires doivent être remplis",
    });
  }

  // Validation du prix
  if (isNaN(prix_location) || parseFloat(prix_location) <= 0) {
    return res.render("ajout_produit", {
      message: "Le prix de location doit être un nombre positif",
    });
  }

  try {
    await pool.query(
      "INSERT INTO produit (type, description, marque, modele, prix_location, etat) VALUES (?, ?, ?, ?, ?, ?)",
      [type, description || "", marque, modele, parseFloat(prix_location), etat]
    );

    res.render("ajout_produit", {
      message: "Produit ajouté avec succès",
    });
  } catch (err) {
    console.error("Erreur ajout produit :", err);
    res.status(500).render("ajout_produit", {
      message: "Erreur lors de l'ajout du produit",
    });
  }
});

// Inscription d'un agent
app.get("/inscription_agent", authMiddleware, isAdmin, (req, res) => {
  res.render("inscription_agent", { message: null });
});

app.post("/inscription_agent", authMiddleware, isAdmin, async (req, res) => {
  const { login, password, nom, prenom, email } = req.body;

  if (!login || !password || !nom || !prenom || !email) {
    return res.render("inscription_agent", {
      message: "Tous les champs sont requis",
    });
  }

  // Validation du mot de passe
  if (password.length < 8) {
    return res.render("inscription_agent", {
      message: "Le mot de passe doit contenir au moins 8 caractères",
    });
  }

  try {
    // Utilisation de bcrypt pour la sécurité
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, ?, ?, ?, ?, ?, 'agent')",
      [login, hashedPassword, nom, prenom, "2000-01-01", email]
    );

    res.render("inscription_agent", {
      message: "Agent créé avec succès",
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.render("inscription_agent", {
        message: "Ce login ou cet email est déjà utilisé",
      });
    }
    console.error("Erreur inscription agent :", error);
    res.status(500).render("inscription_agent", {
      message: "Erreur serveur",
    });
  }
});

// ============================================
// GESTION DES ERREURS
// ============================================

// 404 - Page introuvable
app.use((req, res) => {
  res.status(404).render("404");
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error("Erreur serveur :", err);
  res.status(500).render("error", {
    message: "Une erreur interne est survenue",
    code: 500,
  });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📝 Environnement: ${process.env.NODE_ENV || "development"}`);
});
