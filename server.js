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
      maxAge: 24 * 60 * 60 * 1000 // 24 heures
    },
  })
);

// Expose session data to EJS views
app.use((req, res, next) => {
  res.locals.isLoggedIn = Boolean(req.session?.userId);
  res.locals.userRole = req.session?.userRole || null;
  res.locals.username = req.session?.username || null;
  res.locals.message = null; // Évite les erreurs si message non défini
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
    code: 403 
  });
}

function isAgent(req, res, next) {
  if (req.session?.userRole === "agent" || req.session?.userRole === "admin") {
    return next();
  }
  return res.status(403).render("error", { 
    message: "Accès réservé aux agents",
    code: 403 
  });
}

function isClient(req, res, next) {
  if (req.session?.userRole === "client") return next();
  return res.status(403).render("error", { 
    message: "Accès réservé aux clients",
    code: 403 
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
      message: "Erreur lors du chargement des produits" 
    });
  }
});

// Détail d'un produit
app.get("/product/:id", async (req, res) => {
  try {
    const [produits] = await pool.query(
      "SELECT * FROM produit WHERE id = ?",
      [req.params.id]
    );
    
    if (produits.length === 0) {
      return res.status(404).render("404");
    }
    
    res.render("product", { produit: produits[0] });
  } catch (err) {
    console.error("Erreur récupération produit :", err);
    res.status(500).render("error", { 
      message: "Erreur lors du chargement du produit",
      code: 500 
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
      message: "Tous les champs sont requis" 
    });
  }

  // Validation format email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.render("register", { 
      message: "Format d'email invalide" 
    });
  }

  // Validation longueur mot de passe
  if (password.length < 6) {
    return res.render("register", { 
      message: "Le mot de passe doit contenir au moins 6 caractères" 
    });
  }

  // Validation date de naissance
  const dateNaissance = new Date(ddn);
  const aujourdhui = new Date();
  const age = aujourdhui.getFullYear() - dateNaissance.getFullYear();
  
  if (age < 18) {
    return res.render("register", { 
      message: "Vous devez avoir au moins 18 ans pour vous inscrire" 
    });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, MD5(?), ?, ?, ?, ?, 'client')",
      [login, password, nom, prenom, ddn, email]
    );
    
    res.render("login", { 
      message: "Inscription réussie ! Vous pouvez maintenant vous connecter." 
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.render("register", { 
        message: "Ce login ou cet email est déjà utilisé" 
      });
    }
    console.error("Erreur inscription :", error);
    res.status(500).render("register", { 
      message: "Erreur serveur lors de l'inscription" 
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
    // 1. Récupérer l'utilisateur et vérifier le mot de passe (MD5)
    // La vérification se fait directement dans la clause WHERE avec MD5(?)
    const [results] = await pool.query(
      "SELECT id, login, nom, prenom, type_utilisateur FROM utilisateur WHERE login = ? AND password = MD5(?)",
      [login, password]
    );

    if (results.length === 0) {
      return res.render("login", {
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    const user = results[0];
    
    // CRITIQUE : Vérification du mot de passe avec bcrypt
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
    req.session.loggedin = true;

    const nextUrl = req.session.postLoginRedirect || "/home";
    delete req.session.postLoginRedirect;
    
    return res.redirect(nextUrl);
    
  } catch (error) {
    console.error("Erreur login :", error);
    return res.status(500).render("login", { 
      message: "Erreur interne du serveur" 
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
      message: "Erreur lors du chargement de vos locations" 
    });
  }
});

// Profil client (GET)
app.get("/profil", authMiddleware, isClient, async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT id, login, nom, prenom, ddn, email FROM utilisateur WHERE id = ?",
      [req.session.userId]
    );
    
    if (users.length === 0) {
      return res.redirect("/logout");
    }
    
    res.render("profil", { user: users[0] });
  } catch (err) {
    console.error("Erreur chargement profil :", err);
    res.status(500).render("error", { 
      message: "Erreur lors du chargement du profil",
      code: 500 
    });
  }
});

// Profil client (POST - modification)
app.post("/profil", authMiddleware, isClient, async (req, res) => {
  const { email, nom, prenom } = req.body;
  
  if (!email || !nom || !prenom) {
    return res.render("profil", { 
      message: "Tous les champs sont requis",
      user: req.body 
    });
  }

  try {
    await pool.query(
      "UPDATE utilisateur SET email = ?, nom = ?, prenom = ? WHERE id = ?",
      [email, nom, prenom, req.session.userId]
    );
    
    req.session.username = prenom;
    
    res.render("profil", { 
      message: "Profil mis à jour avec succès",
      user: { email, nom, prenom }
    });
  } catch (err) {
    console.error("Erreur update profil :", err);
    res.status(500).render("profil", { 
      message: "Erreur lors de la mise à jour",
      user: req.body 
    });
  }
});

// Créer une location
app.post("/locations/create", authMiddleware, isClient, async (req, res) => {
  const { produit_id, date_debut, date_retour_prevue } = req.body;
  
  if (!produit_id || !date_debut || !date_retour_prevue) {
    return res.status(400).json({ 
      error: "Tous les champs sont requis" 
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
        error: "Produit non disponible" 
      });
    }

    const produit = produits[0];
    
    // Calculer le prix total
    const debut = new Date(date_debut);
    const fin = new Date(date_retour_prevue);
    const nbJours = Math.ceil((fin - debut) / (1000 * 60 * 60 * 24));
    const prix_total = nbJours * produit.prix_location;

    // Créer la location
    await pool.query(
      "INSERT INTO location (date_debut, date_retour_prevue, prix_total, utilisateur_id, produit_id) VALUES (?, ?, ?, ?, ?)",
      [date_debut, date_retour_prevue, prix_total, req.session.userId, produit_id]
    );

    // Mettre à jour l'état du produit
    await pool.query(
      "UPDATE produit SET etat = 'loué' WHERE id = ?",
      [produit_id]
    );

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
    
    // Mettre à jour la location
    await pool.query(
      "UPDATE location SET date_retour_effective = NOW() WHERE id = ?",
      [location_id]
    );

    // Remettre le produit en disponible
    await pool.query(
      "UPDATE produit SET etat = 'disponible' WHERE id = ?",
      [location.produit_id]
    );

    res.json({ success: true, message: "Retour enregistré" });
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
      message: "Erreur lors du chargement des locations" 
    });
  }
});

// ============================================
// ROUTES ADMIN
// ============================================

// Page d'ajout de produit
app.get("/ajout_produit", isAdmin, (req, res) => {
  res.render("ajout_produit", { message: null });
});

// Ajout de produit
app.post("/ajout_produit", isAdmin, async (req, res) => {
  const { type, marque, modele, prix_location, description, etat } = req.body;
  
  if (!type || !marque || !modele || !prix_location || !etat) {
    return res.render("ajout_produit", { 
      message: "Tous les champs obligatoires doivent être remplis" 
    });
  }

  try {
    await pool.query(
      "INSERT INTO produit (type, description, marque, modele, prix_location, etat) VALUES (?, ?, ?, ?, ?, ?)",
      [type, description || '', marque, modele, prix_location, etat]
    );
    
    res.render("ajout_produit", { 
      message: "Produit ajouté avec succès" 
    });
  } catch (err) {
    console.error("Erreur ajout produit :", err);
    res.status(500).render("ajout_produit", { 
      message: "Erreur lors de l'ajout du produit" 
    });
  }
});

// Inscription d'un agent
app.get("/inscription_agent", isAdmin, (req, res) => {
  res.render("inscription_agent", { message: null });
});

app.post("/inscription_agent", isAdmin, async (req, res) => {
  const { login, password, nom, prenom, email } = req.body;
  
  if (!login || !password || !nom || !prenom || !email) {
    return res.render("inscription_agent", { 
      message: "Tous les champs sont requis" 
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, ?, ?, ?, ?, ?, 'agent')",
      [login, hashedPassword, nom, prenom, '2000-01-01', email]
    );
    
    res.render("inscription_agent", { 
      message: "Agent créé avec succès" 
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.render("inscription_agent", { 
        message: "Ce login ou cet email est déjà utilisé" 
      });
    }
    console.error("Erreur inscription agent :", error);
    res.status(500).render("inscription_agent", { 
      message: "Erreur serveur" 
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
    code: 500 
  });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📝 Environnement: ${process.env.NODE_ENV || 'development'}`);
});
