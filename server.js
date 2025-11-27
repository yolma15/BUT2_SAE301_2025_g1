import express from "express";
import path from "path";
import session from "express-session";
import bcrypt from "bcrypt";
import crypto from "crypto"; // Pour supporter MD5 temporairement
import pool from "./db.js";
import multer from "multer";
import fs from "fs";

const app = express();

// ============================================
// 1. CONFIGURATION MULTER (UPLOAD IMAGES)
// ============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "public/uploads/";
    // Vérifie si le dossier existe, sinon le crée automatiquement
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + cleanName);
  },
});

const upload = multer({ storage: storage });

// ============================================
// 2. CONFIGURATION EXPRESS
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

// Middleware session
app.use((req, res, next) => {
  res.locals.isLoggedIn = Boolean(req.session?.userId);
  res.locals.userRole = req.session?.userRole;
  res.locals.username = req.session?.username;
  res.locals.userImg = req.session?.userImg;
  res.locals.message = null;
  next();
});

// ============================================
// 3. FONCTIONS UTILITAIRES & SÉCURITÉ
// ============================================

async function verifyPassword(plainPassword, hashedPassword) {
  try {
    if (hashedPassword.startsWith("$2b$") || hashedPassword.startsWith("$2a$")) {
      return await bcrypt.compare(plainPassword, hashedPassword);
    }
    const md5Hash = crypto.createHash("md5").update(plainPassword).digest("hex");
    return md5Hash === hashedPassword;
  } catch (error) {
    console.error("Erreur vérification mot de passe:", error);
    return false;
  }
}

async function migratePasswordToBcrypt(userId, plainPassword) {
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    await pool.query("UPDATE utilisateur SET password = ? WHERE id = ?", [
      hashedPassword,
      userId,
    ]);
    console.log(`✅ Mot de passe migré vers bcrypt pour l'utilisateur ${userId}`);
  } catch (error) {
    console.error("Erreur migration mot de passe:", error);
  }
}

// Middlewares Auth
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
// 4. ROUTES PUBLIQUES
// ============================================

app.get("/", (req, res) => res.render("home"));
app.get("/home", (req, res) => res.render("home"));

app.get("/login", (req, res) => {
  if (req.session?.userId) return res.redirect("/home");
  res.render("login", { message: null });
});

app.get("/register", (req, res) => {
  if (req.session?.userId) return res.redirect("/home");
  res.render("register", { message: null });
});

app.post("/register", async (req, res) => {
  const { login, password, nom, prenom, ddn, email } = req.body;

  if (!login || !password || !nom || !prenom || !ddn || !email) {
    return res.render("register", { message: "❌ Tous les champs sont requis." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.render("register", { message: "❌ Format d'email invalide." });

  const dateNaissance = new Date(ddn);
  const today = new Date();
  let age = today.getFullYear() - dateNaissance.getFullYear();
  const m = today.getMonth() - dateNaissance.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateNaissance.getDate())) { age--; }

  if (age < 18) {
      return res.render("register", { message: "⛔ Inscription impossible : Vous devez être majeur." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) 
       VALUES (?, ?, ?, ?, ?, ?, 'client')`,
      [login, hashedPassword, nom, prenom, ddn, email]
    );
    res.render("login", { message: "✅ Inscription réussie ! Connectez-vous." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.render("register", { message: "❌ Login ou email déjà utilisé." });
    res.status(500).render("register", { message: "❌ Erreur serveur." });
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

    if (!user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
      await migratePasswordToBcrypt(user.id, password);
    }

    req.session.userId = user.id;
    req.session.userRole = user.type_utilisateur;
    req.session.username = user.prenom || user.login;
    req.session.userImg = user.img;
    req.session.loggedin = true;

    const nextUrl = req.session.postLoginRedirect || "/home";
    delete req.session.postLoginRedirect;
    res.redirect(nextUrl);
  } catch (error) {
    console.error(error);
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
// 5. ROUTES CLIENT (Catalogue, Locations, Profil)
// ============================================

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
    res.render("catalogue", { produits, categories: categories.map((c) => c.type), currentCategory: category, currentSort: sort, currentSearch: search });
  } catch (err) {
    res.status(500).render("catalogue", { produits: [], categories: [], message: "Erreur chargement produits" });
  }
});

// --- ROUTE PRODUCT (CALCUL DISPONIBILITÉ) ---
app.get("/product/:id", async (req, res) => {
  try {
    const [produits] = await pool.query("SELECT * FROM produit WHERE id = ?", [req.params.id]);
    if (produits.length === 0) return res.status(404).render("404");
    
    const produit = produits[0];
    let dateDispo = null;

    // VÉRIFICATION : Est-ce que ce produit est actuellement dehors (Location non rendue) ?
    const [locations] = await pool.query(
        `SELECT date_retour_prevue 
         FROM location 
         WHERE produit_id = ? AND date_retour_effective IS NULL 
         ORDER BY date_retour_prevue DESC LIMIT 1`,
        [req.params.id]
    );
    
    if (locations.length > 0) {
        // Il y a une location en cours, on calcule la date de retour + 1 jour
        const dateRetour = new Date(locations[0].date_retour_prevue);
        dateRetour.setDate(dateRetour.getDate() + 1); 
        dateDispo = dateRetour.toLocaleDateString("fr-FR");
    }

    res.render("product", { 
        produit: produit, 
        message: req.query.message || null,
        dateDispo: dateDispo // Variable envoyée à la vue
    });
  } catch (err) {
    res.status(500).render("error", { message: "Erreur chargement produit", code: 500 });
  }
});

app.get("/mes-locations", authMiddleware, isClient, async (req, res) => {
  try {
    const [locations] = await pool.query(
      `SELECT l.*, p.type, p.marque, p.modele, p.prix_location 
       FROM location l JOIN produit p ON l.produit_id = p.id
       WHERE l.utilisateur_id = ? ORDER BY l.date_debut DESC`,
      [req.session.userId]
    );
    res.render("mes_locations", { locations });
  } catch (err) {
    res.status(500).render("mes_locations", { locations: [], message: "Erreur chargement locations" });
  }
});

app.get("/profil", authMiddleware, isClient, async (req, res) => {
  try {
    const [users] = await pool.query("SELECT id, login, nom, prenom, ddn, email, img FROM utilisateur WHERE id = ?", [req.session.userId]);
    if (users.length === 0) return res.redirect("/logout");

    const [activeLocations] = await pool.query(
      "SELECT COUNT(*) AS count FROM location WHERE utilisateur_id = ? AND date_retour_effective IS NULL",
      [req.session.userId]
    );
    const hasActiveRentals = activeLocations[0].count > 0;

    let profilMessage = null;
    const msg = req.query.message;
    const msgMap = {
        success_info: { type: "success", text: "Informations mises à jour." },
        success_mdp: { type: "success", text: "Mot de passe changé." },
    };
    if (msg && msgMap[msg]) profilMessage = msgMap[msg];

    res.render("profil", { 
      utilisateur: users[0], 
      profilMessage,
      hasActiveRentals: hasActiveRentals 
    });
  } catch (err) {
    res.status(500).render("error", { message: "Erreur chargement profil", code: 500 });
  }
});

app.post("/profil/informations", authMiddleware, isClient, async (req, res) => {
  const { email, nom, prenom, ddn } = req.body;
  if (!email || !nom || !prenom || !ddn) return res.status(400).json({ error: "Champs requis" });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: "Email invalide" });

  try {
    await pool.query(
      "UPDATE utilisateur SET email = ?, nom = ?, prenom = ?, ddn = ? WHERE id = ?",
      [email, nom, prenom, ddn, req.session.userId]
    );
    req.session.username = prenom;
    req.session.save();
    return res.json({ success: true, message: "Mise à jour réussie" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email déjà utilisé" });
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/profil/password", authMiddleware, isClient, async (req, res) => {
  const { ancien_mdp, nouveau_mdp, confirmer_mdp } = req.body;
  const userId = req.session.userId;

  if (!ancien_mdp || !nouveau_mdp || !confirmer_mdp) return res.status(400).json({ error: "Champs requis" });
  if (nouveau_mdp !== confirmer_mdp) return res.status(400).json({ error: "Les mots de passe ne correspondent pas" });
  if (nouveau_mdp.length < 4) return res.status(400).json({ error: "Mot de passe trop court" });

  try {
    const [users] = await pool.query("SELECT password FROM utilisateur WHERE id = ?", [userId]);
    const match = await verifyPassword(ancien_mdp, users[0].password);
    if (!match) return res.status(401).json({ error: "Ancien mot de passe incorrect" });

    const newHash = await bcrypt.hash(nouveau_mdp, 10);
    await pool.query("UPDATE utilisateur SET password = ? WHERE id = ?", [newHash, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.delete("/profil/delete", authMiddleware, isClient, async (req, res) => {
  try {
    const [locations] = await pool.query(
      "SELECT * FROM location WHERE utilisateur_id = ? AND date_retour_effective IS NULL",
      [req.session.userId]
    );

    if (locations.length > 0) {
      return res.status(400).json({ error: "Impossible : locations en cours." });
    }

    await pool.query("DELETE FROM utilisateur WHERE id = ?", [req.session.userId]);
    req.session.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- CRÉATION LOCATION (SÉCURISÉE) ---
app.post("/locations/create", authMiddleware, isClient, async (req, res) => {
  const { produit_id, date_debut, date_retour_prevue } = req.body;
  if (!produit_id || !date_debut || !date_retour_prevue) return res.status(400).send("Champs requis");

  const debut = new Date(date_debut);
  const fin = new Date(date_retour_prevue);
  if (debut < new Date().setHours(0, 0, 0, 0)) return res.status(400).send("Date début invalide");
  if (fin <= debut) return res.status(400).send("Date fin invalide");

  try {
    // 1. Vérification si déjà loué
    const [alreadyRented] = await pool.query(
        "SELECT * FROM location WHERE produit_id = ? AND date_retour_effective IS NULL",
        [produit_id]
    );
    if (alreadyRented.length > 0) {
        return res.status(400).send("Erreur : Ce produit est actuellement indisponible.");
    }

    // 2. Vérification état
    const [prods] = await pool.query("SELECT * FROM produit WHERE id = ? AND etat = 'disponible'", [produit_id]);
    if (prods.length === 0) return res.status(400).send("Produit non disponible.");

    const produit = prods[0];
    const nbJours = Math.ceil((fin - debut) / (1000 * 60 * 60 * 24)) || 1;
    const total = nbJours * produit.prix_location;

    await pool.query(
      "INSERT INTO location (date_debut, date_retour_prevue, prix_total, utilisateur_id, produit_id) VALUES (?, ?, ?, ?, ?)",
      [date_debut, date_retour_prevue, total, req.session.userId, produit_id]
    );
    
    // On met à jour l'état, bien que la vérification se fasse surtout sur la table location
    await pool.query("UPDATE produit SET etat = 'loué' WHERE id = ?", [produit_id]);
    
    res.redirect('/mes-locations');
  } catch (err) {
    res.status(500).send("Erreur création location");
  }
});

// ============================================
// 6. ROUTES AGENT & ADMIN
// ============================================

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

app.get("/agent/returnprod", authMiddleware, isAgent, async (req, res) => {
    try {
        const [locations] = await pool.query(`
            SELECT l.id, l.date_debut, l.date_retour_prevue, l.prix_total, 
                   p.marque, p.modele, p.img, p.prix_location,
                   u.nom, u.prenom, u.email
            FROM location l
            JOIN produit p ON l.produit_id = p.id
            JOIN utilisateur u ON l.utilisateur_id = u.id
            WHERE l.date_retour_effective IS NULL
            ORDER BY l.date_retour_prevue ASC
        `);
        res.render("returnprod", { locations });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

app.post("/agent/finaliser_location/:id", authMiddleware, isAgent, async (req, res) => {
  const locationId = req.params.id;
  const { surcout } = req.body;

  try {
    const [locations] = await pool.query("SELECT * FROM location WHERE id = ?", [locationId]);
    if (locations.length === 0) return res.status(404).json({ error: "Location introuvable" });

    const location = locations[0];
    if (location.date_retour_effective) return res.status(400).json({ error: "Déjà finalisée" });

    const dateDebut = new Date(location.date_debut);
    const dateRetourEffective = new Date();
    const dureeReelle = Math.ceil((dateRetourEffective - dateDebut) / (1000 * 60 * 60 * 24));
    
    let prixFinal = parseFloat(location.prix_total);
    if (surcout) {
        prixFinal += parseFloat(surcout);
    }

    if (dureeReelle > 60) {
        const [produits] = await pool.query("SELECT prix_location FROM produit WHERE id = ?", [location.produit_id]);
        prixFinal += parseFloat(produits[0].prix_location) * 0.2;
    }

    await pool.query("UPDATE location SET date_retour_effective = NOW(), prix_total = ? WHERE id = ?", [prixFinal, locationId]);
    await pool.query("UPDATE produit SET etat = 'disponible' WHERE id = ?", [location.produit_id]);
    
    res.json({ success: true, message: "Location finalisée.", prix_final: prixFinal });
  } catch (err) {
    res.status(500).json({ error: "Erreur finalisation" });
  }
});

app.post("/agent/supprimer_produit/:id", authMiddleware, isAgent, async (req, res) => {
  const produitId = req.params.id;
  try {
    const [locations] = await pool.query("SELECT COUNT(*) as count FROM location WHERE produit_id = ? AND date_retour_effective IS NULL", [produitId]);
    if (locations[0].count > 0) return res.status(400).json({ error: "Produit en location." });

    await pool.query("DELETE FROM produit WHERE id = ?", [produitId]);
    res.json({ success: true, message: "Produit supprimé." });
  } catch (err) {
    res.status(500).json({ error: "Erreur suppression" });
  }
});

app.get("/agent/modifier_produit/:id", authMiddleware, isAgent, async (req, res) => {
  try {
    const [produits] = await pool.query("SELECT * FROM produit WHERE id = ?", [req.params.id]);
    if (produits.length === 0) return res.status(404).render("404");
    res.render("modifier_produit", { produit: produits[0], message: null });
  } catch (err) {
    res.status(500).render("error", { message: "Erreur chargement", code: 500 });
  }
});

app.post("/agent/modifier_produit/:id", authMiddleware, isAgent, upload.single("image"), async (req, res) => {
  const { type, marque, modele, prix_location, description, etat } = req.body;
  const produitId = req.params.id;
  const imageFilename = req.file ? req.file.filename : req.body.current_image;

  try {
    await pool.query(
      "UPDATE produit SET type = ?, description = ?, marque = ?, modele = ?, prix_location = ?, etat = ?, img = ? WHERE id = ?",
      [type, description || "", marque, modele, parseFloat(prix_location), etat, imageFilename, produitId]
    );
    res.redirect(`/product/${produitId}?message=success`);
  } catch (err) {
    const [produits] = await pool.query("SELECT * FROM produit WHERE id = ?", [produitId]);
    res.render("modifier_produit", { produit: produits[0], message: "❌ Erreur modification" });
  }
});

app.get("/agent/ajout_produit", authMiddleware, isAgent, (req, res) => res.render("ajout_produit", { message: null }));

app.post("/agent/ajout_produit", authMiddleware, isAgent, upload.single("image"), async (req, res) => {
  const { type, marque, modele, prix_location, description, etat } = req.body;
  const imageFilename = req.file ? req.file.filename : null;

  if (!type || !marque || !modele || !prix_location) return res.render("ajout_produit", { message: "❌ Champs requis manquants" });

  try {
    await pool.query(
      "INSERT INTO produit (type, description, marque, modele, prix_location, etat, img) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [type, description || "", marque, modele, parseFloat(prix_location), etat, imageFilename]
    );
    res.render("ajout_produit", { message: "✅ Produit ajouté !" });
  } catch (err) {
    res.status(500).render("ajout_produit", { message: "❌ Erreur ajout base de données" });
  }
});

app.get("/inscription_agent", authMiddleware, isAdmin, (req, res) => res.render("inscription_agent", { message: null }));

app.post("/inscription_agent", authMiddleware, isAdmin, upload.single("image"), async (req, res) => {
  const { login, password, nom, prenom, ddn, email } = req.body;
  const imageFilename = req.file ? req.file.filename : null;

  if (!login || !password || !nom || !prenom || !email || !ddn) return res.render("inscription_agent", { message: "❌ Tous les champs sont requis." });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur, img) VALUES (?, ?, ?, ?, ?, ?, 'agent', ?)`,
      [login, hash, nom, prenom, ddn, email, imageFilename]
    );
    res.render("inscription_agent", { message: "✅ Agent ajouté avec succès !" });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.render("inscription_agent", { message: "❌ Login/Email déjà utilisé." });
    res.status(500).render("inscription_agent", { message: "❌ Erreur serveur." });
  }
});

app.get("/prix", (req, res) => {
  res.render("prix", { message: null });
});

// ============================================
// DÉMARRAGE
// ============================================

app.use((req, res) => res.status(404).render("404"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});