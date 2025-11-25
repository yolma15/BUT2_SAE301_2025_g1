import express from "express";
import path from "path";
import session from "express-session";
import bcrypt from "bcrypt";
import crypto from "crypto"; // Pour supporter MD5 temporairement
import pool from "./db.js";

const app = express();

// ============================================
// CONFIGURATION
// ============================================

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

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

// Middleware pour exposer les données de session aux vues EJS
app.use((req, res, next) => {
  res.locals.isLoggedIn = Boolean(req.session?.userId);
  res.locals.userRole = req.session?.userRole;
  res.locals.username = req.session?.username; 
  res.locals.userImg = req.session?.userImg;
  res.locals.message = null;
  next();
});

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

async function verifyPassword(plainPassword, hashedPassword) {
  try {
    if (hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2a$')) {
      return await bcrypt.compare(plainPassword, hashedPassword);
    }
    const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
    return md5Hash === hashedPassword;
  } catch (error) {
    console.error('Erreur vérification mot de passe:', error);
    return false;
  }
}

async function migratePasswordToBcrypt(userId, plainPassword) {
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    await pool.query('UPDATE utilisateur SET password = ? WHERE id = ?', [hashedPassword, userId]);
    console.log(`✅ Mot de passe migré vers bcrypt pour l'utilisateur ${userId}`);
  } catch (error) {
    console.error('Erreur migration mot de passe:', error);
  }
}

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
  return res.status(403).render("error", { message: "Accès réservé aux administrateurs", code: 403 });
}

function isAgent(req, res, next) {
  if (req.session?.userRole === "agent" || req.session?.userRole === "admin") return next();
  return res.status(403).render("error", { message: "Accès réservé aux agents", code: 403 });
}

function isClient(req, res, next) {
  if (req.session?.userRole === "client") return next();
  return res.status(403).render("error", { message: "Accès réservé aux clients", code: 403 });
}

// ============================================
// ROUTES PUBLIQUES (Home, Catalog, Product)
// ============================================

app.get("/", (req, res) => res.render("home"));
app.get("/home", (req, res) => res.render("home"));

app.get("/login", (req, res) => {
  if (req.session?.userId) {
    if (req.session.userRole === 'agent') return res.redirect("/agent");
    if (req.session.userRole === 'admin') return res.redirect("/inscription_agent");
    return res.redirect("/home");
  }
  res.render("login", { message: null });
});

app.get("/register", (req, res) => {
  if (req.session?.userId) return res.redirect("/home");
  res.render("register", { message: null });
});

// Catalogue
app.get("/catalogue", async (req, res) => {
  const { sort, search, category } = req.query;
  let query = "SELECT * FROM produit WHERE etat != 'supprimé'";
  const params = [];

  if (search) {
    query += " AND (modele LIKE ? OR marque LIKE ? OR description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    query += " AND type = ?";
    params.push(category);
  }

  switch (sort) {
    case "priceAsc": query += " ORDER BY prix_location ASC"; break;
    case "priceDesc": query += " ORDER BY prix_location DESC"; break;
    default: query += " ORDER BY id DESC"; break;
  }

  try {
    const [produits] = await pool.query(query, params);
    const [categories] = await pool.query("SELECT DISTINCT type FROM produit WHERE etat != 'supprimé'");

    res.render("catalogue", { 
      produits,
      categories: categories.map(c => c.type),
      currentCategory: category,
      currentSort: sort,
      currentSearch: search,
    });
  } catch (err) {
    res.status(500).render("catalogue", { produits: [], categories: [], message: "Erreur chargement produits" });
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    const [produits] = await pool.query("SELECT * FROM produit WHERE id = ?", [req.params.id]);
    if (produits.length === 0) return res.status(404).render("404");
    res.render("product", { produit: produits[0] });
  } catch (err) {
    res.status(500).render("error", { message: "Erreur chargement produit", code: 500 });
  }
});

// ============================================
// AUTHENTIFICATION (Login/Register/Logout)
// ============================================

app.post("/register", async (req, res) => {
  const { login, password, nom, prenom, ddn, email } = req.body;

  if (!login || !password || !nom || !prenom || !ddn || !email) return res.render("register", { message: "Tous les champs sont requis" });
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.render("register", { message: "Email invalide" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, ?, ?, ?, ?, ?, 'client')",
      [login, hashedPassword, nom, prenom, ddn, email]
    );
    res.render("login", { message: "Inscription réussie !" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.render("register", { message: "Login ou email déjà utilisé" });
    res.status(500).render("register", { message: "Erreur serveur" });
  }
});

app.post("/login", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.render("login", { message: "Identifiants requis" });

  try {
    const [results] = await pool.query("SELECT * FROM utilisateur WHERE login = ?", [login]);
    if (results.length === 0) return res.render("login", { message: "Identifiants incorrects" });

    const user = results[0];
    const match = await verifyPassword(password, user.password);
    if (!match) return res.render("login", { message: "Identifiants incorrects" });

    if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
      await migratePasswordToBcrypt(user.id, password);
    }

    req.session.userId = user.id;
    req.session.userRole = user.type_utilisateur;
    req.session.username = user.prenom || user.login;
    req.session.userImg = user.img;
    req.session.loggedin = true;

    // --- REDIRECTION CIBLÉE ---
    let defaultUrl = "/home";
    if (user.type_utilisateur === 'agent') defaultUrl = "/agent";
    if (user.type_utilisateur === 'admin') defaultUrl = "/inscription_agent";

    const nextUrl = req.session.postLoginRedirect || defaultUrl;
    delete req.session.postLoginRedirect;
    res.redirect(nextUrl);

  } catch (error) {
    res.status(500).render("login", { message: "Erreur serveur" });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

// ============================================
// ROUTES CLIENT (Profil, Location, Retour)
// ============================================

app.get("/profil", authMiddleware, isClient, async (req, res) => {
  try {
    const [users] = await pool.query("SELECT * FROM utilisateur WHERE id = ?", [req.session.userId]);
    if (users.length === 0) return res.redirect("/logout");
    
    // Logique simplifiée pour les messages
    const msg = req.query.message;
    const messages = {
        "success_info": { type: "success", text: "Informations mises à jour." },
        "success_mdp": { type: "success", text: "Mot de passe changé." }
    };
    
    res.render("profil", { utilisateur: users[0], profilMessage: messages[msg] || null });
  } catch (err) {
    res.status(500).render("error", { message: "Erreur profil", code: 500 });
  }
});

// Mise à jour profil (JSON)
app.post("/profil/informations", authMiddleware, isClient, async (req, res) => {
  const { email, nom, prenom, ddn } = req.body;
  if (!email || !nom || !prenom || !ddn) return res.status(400).json({ error: "Champs requis" });

  try {
    const [result] = await pool.query(
      "UPDATE utilisateur SET email = ?, nom = ?, prenom = ?, ddn = ? WHERE id = ?",
      [email, nom, prenom, ddn, req.session.userId]
    );

    req.session.username = prenom;
    req.session.save(() => {
      res.json({ success: true, message: "Mise à jour réussie" });
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email déjà utilisé" });
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Changement mot de passe (JSON)
app.post("/profil/password", authMiddleware, isClient, async (req, res) => {
  const { ancien_mdp, nouveau_mdp, confirmer_mdp } = req.body;
  if (nouveau_mdp !== confirmer_mdp) return res.status(400).json({ error: "Mots de passe différents" });

  try {
    const [u] = await pool.query("SELECT password FROM utilisateur WHERE id = ?", [req.session.userId]);
    if (!await verifyPassword(ancien_mdp, u[0].password)) return res.status(401).json({ error: "Ancien mot de passe incorrect" });

    const newHash = await bcrypt.hash(nouveau_mdp, 10);
    await pool.query("UPDATE utilisateur SET password = ? WHERE id = ?", [newHash, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/mes-locations", authMiddleware, isClient, async (req, res) => {
    try {
        const [locations] = await pool.query(
            `SELECT l.*, p.marque, p.modele FROM location l JOIN produit p ON l.produit_id = p.id WHERE l.utilisateur_id = ?`,
            [req.session.userId]
        );
        res.render("mes_locations", { locations });
    } catch (e) { res.status(500).render("error", { message: "Erreur", code: 500 }); }
});

app.post("/locations/create", authMiddleware, isClient, async (req, res) => {
    // ... (Logique de création location conservée, simplifiée pour brièveté ici)
    const { produit_id, date_debut, date_retour_prevue } = req.body;
    try {
        const [p] = await pool.query("SELECT * FROM produit WHERE id = ?", [produit_id]);
        const total = p[0].prix_location; // Simplifié, ajoutez le calcul de jours
        await pool.query("INSERT INTO location (date_debut, date_retour_prevue, prix_total, utilisateur_id, produit_id) VALUES (?,?,?,?,?)",
            [date_debut, date_retour_prevue, total, req.session.userId, produit_id]);
        await pool.query("UPDATE produit SET etat = 'loué' WHERE id = ?", [produit_id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur" }); }
});

app.get("/returnprod", authMiddleware, isClient, (req, res) => res.render("returnprod"));
app.post("/returnprod", authMiddleware, isClient, async (req, res) => {
    const { location_id } = req.body;
    try {
        const [l] = await pool.query("SELECT * FROM location WHERE id = ?", [location_id]);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await pool.query("UPDATE location SET date_retour_effective = ? WHERE id = ?", [now, location_id]);
        await pool.query("UPDATE produit SET etat = 'disponible' WHERE id = ?", [l[0].produit_id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur" }); }
});


// ============================================
// ROUTES AGENT (Ajout Produit & Locations)
// ============================================

// 1. Afficher le formulaire d'ajout (utilise views/agent.ejs)
app.get("/agent", authMiddleware, isAgent, (req, res) => {
  res.render("agent", { message: null });
});

// 2. Traiter le formulaire et AJOUTER EN BDD
app.post("/agent", authMiddleware, isAgent, async (req, res) => {
  const { type, marque, modele, prix_location, description, etat } = req.body;
  
  // Validation
  if (!type || !marque || !modele || !prix_location || !etat) {
    return res.render("agent", { 
      message: "Erreur : Tous les champs obligatoires (Type, Marque, Modèle, Prix, État) sont requis." 
    });
  }

  try {
    const query = `
      INSERT INTO produit (type, marque, modele, prix_location, etat, description) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      type, 
      marque, 
      modele, 
      parseFloat(prix_location), 
      etat, 
      description || "" 
    ];

    await pool.query(query, values);

    res.render("agent", { 
      message: "✅ Succès : Le produit a bien été ajouté au catalogue !" 
    });

  } catch (err) {
    console.error("Erreur ajout produit BDD :", err);
    res.status(500).render("agent", { 
      message: "❌ Erreur serveur lors de l'enregistrement en base de données." 
    });
  }
});

// Voir toutes les locations
app.get("/locations", authMiddleware, isAgent, async (req, res) => {
  try {
    const [locations] = await pool.query(`
      SELECT l.*, u.nom, u.prenom, u.email, p.type, p.marque, p.modele
      FROM location l 
      JOIN utilisateur u ON l.utilisateur_id = u.id 
      JOIN produit p ON l.produit_id = p.id 
      ORDER BY l.date_debut DESC
    `);
    res.render("locations", { locations });
  } catch (err) {
    res.status(500).render("locations", { locations: [], message: "Erreur" });
  }
});

// ============================================
// ROUTES ADMIN (Ajout Agent)
// ============================================

app.get("/inscription_agent", authMiddleware, isAdmin, (req, res) => res.render("inscription_agent", { message: null }));

app.post("/inscription_agent", authMiddleware, isAdmin, async (req, res) => {
  const { login, password, nom, prenom, email } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, ?, ?, ?, '2000-01-01', ?, 'agent')",
      [login, hash, nom, prenom, email]
    );
    res.render("inscription_agent", { message: "Agent créé" });
  } catch (err) {
    res.status(500).render("inscription_agent", { message: "Erreur" });
  }
});

// ============================================
// DÉMARRAGE
// ============================================

app.use((req, res) => res.status(404).render("404"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});