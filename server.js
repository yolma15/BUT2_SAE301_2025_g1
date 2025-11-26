import express from "express";
import path from "path";
import session from "express-session";
import bcrypt from "bcrypt";
import crypto from "crypto"; // Pour supporter MD5 temporairement
import pool from "./db.js";
import multer from "multer"; // IMPORT INDISPENSABLE
import fs from "fs"; // IMPORT INDISPENSABLE

const app = express();

// ============================================
// CONFIGURATION MULTER (UPLOAD IMAGES)
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
// CONFIGURATION EXPRESS
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
    if (
      hashedPassword.startsWith("$2b$") ||
      hashedPassword.startsWith("$2a$")
    ) {
      return await bcrypt.compare(plainPassword, hashedPassword);
    }
    const md5Hash = crypto
      .createHash("md5")
      .update(plainPassword)
      .digest("hex");
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
    console.log(
      `✅ Mot de passe migré vers bcrypt pour l'utilisateur ${userId}`
    );
  } catch (error) {
    console.error("Erreur migration mot de passe:", error);
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
  return res.status(403).render("error", {
    message: "Accès réservé aux administrateurs",
    code: 403,
  });
}

function isAgent(req, res, next) {
  if (req.session?.userRole === "agent" || req.session?.userRole === "admin")
    return next();
  return res
    .status(403)
    .render("error", { message: "Accès réservé aux agents", code: 403 });
}

function isClient(req, res, next) {
  if (req.session?.userRole === "client") return next();
  return res
    .status(403)
    .render("error", { message: "Accès réservé aux clients", code: 403 });
}

// ============================================
// ROUTES PUBLIQUES
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

// Catalogue produits avec filtres et tri
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
    case "priceAsc":
      query += " ORDER BY prix_location ASC";
      break;
    case "priceDesc":
      query += " ORDER BY prix_location DESC";
      break;
    default:
      query += " ORDER BY id DESC";
      break;
  }

  try {
    const [produits] = await pool.query(query, params);
    const [categories] = await pool.query(
      "SELECT DISTINCT type FROM produit WHERE etat != 'supprimé'"
    );

    res.render("catalogue", {
      produits,
      categories: categories.map((c) => c.type),
      currentCategory: category,
      currentSort: sort,
      currentSearch: search,
    });
  } catch (err) {
    console.error("Erreur catalogue :", err);
    res.status(500).render("catalogue", {
      produits: [],
      categories: [],
      message: "Erreur chargement produits",
    });
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    const [produits] = await pool.query("SELECT * FROM produit WHERE id = ?", [
      req.params.id,
    ]);
    if (produits.length === 0) return res.status(404).render("404");
    
    res.render("product", { 
        produit: produits[0], 
        message: req.query.message || null 
    });
  } catch (err) {
    res
      .status(500)
      .render("error", { message: "Erreur chargement produit", code: 500 });
  }
});

// ============================================
// LOGIQUE AUTHENTIFICATION (Login/Register)
// ============================================

app.post("/register", async (req, res) => {
  const { login, password, nom, prenom, ddn, email } = req.body;

  if (!login || !password || !nom || !prenom || !ddn || !email) {
    return res.render("register", { message: "Tous les champs sont requis" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.render("register", { message: "Format d'email invalide" });

  if (password.length < 4)
    return res.render("register", { message: "Mot de passe trop court" });

  const dateNaissance = new Date(ddn);
  const age = new Date().getFullYear() - dateNaissance.getFullYear();
  if (age < 18)
    return res.render("register", {
      message: "Vous devez avoir au moins 18 ans",
    });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, ?, ?, ?, ?, ?, 'client')",
      [login, hashedPassword, nom, prenom, ddn, email]
    );
    res.render("login", { message: "Inscription réussie !" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res.render("register", { message: "Login ou email déjà utilisé" });
    res.status(500).render("register", { message: "Erreur serveur" });
  }
});

app.post("/login", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password)
    return res.render("login", { message: "Identifiants requis" });

  try {
    const [results] = await pool.query(
      "SELECT * FROM utilisateur WHERE login = ?",
      [login]
    );
    if (results.length === 0)
      return res.render("login", { message: "Identifiants incorrects" });

    const user = results[0];
    const match = await verifyPassword(password, user.password);
    if (!match)
      return res.render("login", { message: "Identifiants incorrects" });

    if (
      !user.password.startsWith("$2b$") &&
      !user.password.startsWith("$2a$")
    ) {
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
// ROUTES CLIENT (PROFIL & LOCATIONS)
// ============================================

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
    res.status(500).render("mes_locations", {
      locations: [],
      message: "Erreur chargement locations",
    });
  }
});

app.get("/profil", authMiddleware, isClient, async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT id, login, nom, prenom, ddn, email, img FROM utilisateur WHERE id = ?",
      [req.session.userId]
    );

    if (users.length === 0) return res.redirect("/logout");

    let profilMessage = null;
    const msg = req.query.message;
    const msgMap = {
      success_info: { type: "success", text: "Informations mises à jour." },
      success_mdp: { type: "success", text: "Mot de passe changé." },
      error_info: { type: "error", text: "Erreur mise à jour infos." },
      email_used: { type: "error", text: "Email déjà utilisé." },
      mdp_mismatch: { type: "error", text: "Ancien mot de passe incorrect." },
      new_mdp_mismatch: {
        type: "error",
        text: "Les nouveaux mots de passe ne correspondent pas.",
      },
      same_password: {
        type: "error",
        text: "Le nouveau mot de passe doit être différent.",
      },
      password_too_short: { type: "error", text: "Mot de passe trop court." },
    };

    if (msg && msgMap[msg]) profilMessage = msgMap[msg];

    res.render("profil", { utilisateur: users[0], profilMessage });
  } catch (err) {
    res
      .status(500)
      .render("error", { message: "Erreur chargement profil", code: 500 });
  }
});

app.post("/profil/informations", authMiddleware, isClient, async (req, res) => {
  const { email, nom, prenom, ddn } = req.body;

  if (!email || !nom || !prenom || !ddn)
    return res.status(400).json({ error: "Champs requis" });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: "Email invalide" });

  try {
    const [result] = await pool.query(
      "UPDATE utilisateur SET email = ?, nom = ?, prenom = ?, ddn = ? WHERE id = ?",
      [email, nom, prenom, ddn, req.session.userId]
    );

    req.session.username = prenom;

    req.session.save((err) => {
      if (err) {
        console.error("Erreur save session:", err);
        return res.status(500).json({ error: "Erreur sauvegarde session" });
      }
      if (result.affectedRows > 0) {
        return res.json({ success: true, message: "Mise à jour réussie" });
      }
      return res.json({ success: true, message: "Aucune modification" });
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Email déjà utilisé" });
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/profil/password", authMiddleware, isClient, async (req, res) => {
  const { ancien_mdp, nouveau_mdp, confirmer_mdp } = req.body;
  const userId = req.session.userId;

  if (!ancien_mdp || !nouveau_mdp || !confirmer_mdp)
    return res.status(400).json({ error: "Champs requis" });
  if (nouveau_mdp !== confirmer_mdp)
    return res
      .status(400)
      .json({ error: "Les mots de passe ne correspondent pas" });
  if (ancien_mdp === nouveau_mdp)
    return res
      .status(400)
      .json({ error: "Le mot de passe doit être différent" });
  if (nouveau_mdp.length < 4)
    return res.status(400).json({ error: "Mot de passe trop court" });

  try {
    const [users] = await pool.query(
      "SELECT password FROM utilisateur WHERE id = ?",
      [userId]
    );
    if (users.length === 0)
      return res.status(404).json({ error: "Utilisateur introuvable" });

    const match = await verifyPassword(ancien_mdp, users[0].password);
    if (!match)
      return res.status(401).json({ error: "Ancien mot de passe incorrect" });

    const newHash = await bcrypt.hash(nouveau_mdp, 10);
    await pool.query("UPDATE utilisateur SET password = ? WHERE id = ?", [
      newHash,
      userId,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/locations/create", authMiddleware, isClient, async (req, res) => {
  const { produit_id, date_debut, date_retour_prevue } = req.body;
  if (!produit_id || !date_debut || !date_retour_prevue)
    return res.status(400).json({ error: "Champs requis" });

  const debut = new Date(date_debut);
  const fin = new Date(date_retour_prevue);
  if (debut < new Date().setHours(0, 0, 0, 0))
    return res.status(400).json({ error: "Date début invalide" });
  if (fin <= debut) return res.status(400).json({ error: "Date fin invalide" });

  try {
    const [prods] = await pool.query(
      "SELECT * FROM produit WHERE id = ? AND etat = 'disponible'",
      [produit_id]
    );
    if (prods.length === 0)
      return res.status(400).json({ error: "Produit non disponible" });

    const produit = prods[0];
    const nbJours = Math.ceil((fin - debut) / (1000 * 60 * 60 * 24)) || 1;
    const total = nbJours * produit.prix_location;

    await pool.query(
      "INSERT INTO location (date_debut, date_retour_prevue, prix_total, utilisateur_id, produit_id) VALUES (?, ?, ?, ?, ?)",
      [date_debut, date_retour_prevue, total, req.session.userId, produit_id]
    );
    await pool.query("UPDATE produit SET etat = 'loué' WHERE id = ?", [
      produit_id,
    ]);

    res.redirect('/mes-locations'); 

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur lors de la création de la location");
  }
});

app.get("/returnprod", authMiddleware, isClient, (req, res) =>
  res.render("returnprod")
);

app.post("/returnprod", authMiddleware, isClient, async (req, res) => {
  const { location_id } = req.body;
  if (!location_id) return res.status(400).json({ error: "ID requis" });

  try {
    const [locs] = await pool.query(
      "SELECT * FROM location WHERE id = ? AND utilisateur_id = ?",
      [location_id, req.session.userId]
    );
    if (locs.length === 0)
      return res.status(404).json({ error: "Location introuvable" });

    const loc = locs[0];
    if (loc.date_retour_effective)
      return res.status(400).json({ error: "Déjà retourné" });

    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await pool.query(
      "UPDATE location SET date_retour_effective = ? WHERE id = ?",
      [now, location_id]
    );
    await pool.query("UPDATE produit SET etat = 'disponible' WHERE id = ?", [
      loc.produit_id,
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur retour" });
  }
});

// ============================================
// ROUTES AGENT & ADMIN
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

// 1️⃣ Suppression d'un produit (agent uniquement)
app.post(
  "/agent/supprimer_produit/:id",
  authMiddleware,
  isAgent,
  async (req, res) => {
    const produitId = req.params.id;

    try {
      // Vérifier si le produit est en location
      const [locations] = await pool.query(
        "SELECT COUNT(*) as count FROM location WHERE produit_id = ? AND date_retour_effective IS NULL",
        [produitId]
      );

      if (locations[0].count > 0) {
        return res.status(400).json({
          error:
            "Impossible de supprimer : ce produit est actuellement en location",
        });
      }

      // Supprimer le produit
      await pool.query("DELETE FROM produit WHERE id = ?", [produitId]);

      res.json({ success: true, message: "Produit supprimé avec succès" });
    } catch (err) {
      console.error("Erreur suppression produit:", err);
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  }
);

// 2️⃣ Finaliser une location (agent uniquement)
app.post(
  "/agent/finaliser_location/:id",
  authMiddleware,
  isAgent,
  async (req, res) => {
    const locationId = req.params.id;

    try {
      // Récupérer la location
      const [locations] = await pool.query(
        "SELECT * FROM location WHERE id = ?",
        [locationId]
      );

      if (locations.length === 0) {
        return res.status(404).json({ error: "Location introuvable" });
      }

      const location = locations[0];

      if (location.date_retour_effective) {
        return res
          .status(400)
          .json({ error: "Cette location est déjà finalisée" });
      }

      // Calculer le surcoût si retour en retard ou > 60 jours
      const dateDebut = new Date(location.date_debut);
      const dateRetourPrevue = new Date(location.date_retour_prevue);
      const dateRetourEffective = new Date();

      const dureeReelle = Math.ceil(
        (dateRetourEffective - dateDebut) / (1000 * 60 * 60 * 24)
      );
      const dureeMax = 60;

      let prixFinal = parseFloat(location.prix_total);

      // Surcoût si > 60 jours OU retard
      if (dureeReelle > dureeMax || dateRetourEffective > dateRetourPrevue) {
        const [produits] = await pool.query(
          "SELECT prix_location FROM produit WHERE id = ?",
          [location.produit_id]
        );
        const prixBase = parseFloat(produits[0].prix_location);
        const surcoutCalcule = prixBase * 0.2; // 20% du prix de base
        prixFinal += surcoutCalcule;
      }

      // Finaliser la location
      await pool.query(
        "UPDATE location SET date_retour_effective = NOW(), prix_total = ? WHERE id = ?",
        [prixFinal, locationId]
      );

      // Remettre le produit disponible
      await pool.query("UPDATE produit SET etat = 'disponible' WHERE id = ?", [
        location.produit_id,
      ]);

      res.json({
        success: true,
        message: "Location finalisée avec succès",
        prix_final: prixFinal,
      });
    } catch (err) {
      console.error("Erreur finalisation location:", err);
      res.status(500).json({ error: "Erreur lors de la finalisation" });
    }
  }
);

// 3️⃣ Afficher formulaire modification produit
app.get(
  "/agent/modifier_produit/:id",
  authMiddleware,
  isAgent,
  async (req, res) => {
    try {
      const [produits] = await pool.query(
        "SELECT * FROM produit WHERE id = ?",
        [req.params.id]
      );
      if (produits.length === 0) return res.status(404).render("404");

      res.render("modifier_produit", { produit: produits[0], message: null });
    } catch (err) {
      res
        .status(500)
        .render("error", { message: "Erreur chargement produit", code: 500 });
    }
  }
);

// 4️⃣ Traiter modification produit
app.post(
  "/agent/modifier_produit/:id",
  authMiddleware,
  isAgent,
  upload.single("image"),
  async (req, res) => {
    const { type, marque, modele, prix_location, description, etat } = req.body;
    const produitId = req.params.id;

    // Si nouvelle image uploadée, utiliser le nouveau nom
    const imageFilename = req.file ? req.file.filename : req.body.current_image;

    try {
      await pool.query(
        "UPDATE produit SET type = ?, description = ?, marque = ?, modele = ?, prix_location = ?, etat = ?, img = ? WHERE id = ?",
        [
          type,
          description || "",
          marque,
          modele,
          parseFloat(prix_location),
          etat,
          imageFilename,
          produitId,
        ]
      );

      res.redirect(`/product/${produitId}?message=success`);
    } catch (err) {
      console.error("Erreur modification produit:", err);
      const [produits] = await pool.query(
        "SELECT * FROM produit WHERE id = ?",
        [produitId]
      );
      res.render("modifier_produit", {
        produit: produits[0],
        message: "❌ Erreur lors de la modification",
      });
    }
  }
);

// Route Affichage Formulaire Ajout
app.get("/agent/ajout_produit", authMiddleware, isAgent, (req, res) => {
  res.render("ajout_produit", { message: null });
});

app.get("/agent/returnprod", authMiddleware, isAgent, (req, res) => {
  res.render("returnprod", { message: null });
});

app.get("/agent/locations", authMiddleware, isAgent, (req, res) => {
  res.render("locations", { message: null });
});

// --- MODIFICATION ICI : Traitement Formulaire avec Image ---
// On utilise upload.single('image') pour gérer le fichier envoyé
app.post(
  "/agent/ajout_produit",
  authMiddleware,
  isAgent,
  upload.single("image"),
  async (req, res) => {
    // Grâce à multer, req.body contient maintenant les champs textes
    const { type, marque, modele, prix_location, description, etat } = req.body;

    // Et req.file contient le fichier image
    const imageFilename = req.file ? req.file.filename : null;

    if (!type || !marque || !modele || !prix_location) {
      return res.render("ajout_produit", {
        message: "❌ Champs requis manquants",
      });
    }

    try {
      // Insertion dans la BDD avec le nom de l'image
      await pool.query(
        "INSERT INTO produit (type, description, marque, modele, prix_location, etat, img) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          type,
          description || "",
          marque,
          modele,
          parseFloat(prix_location),
          etat,
          imageFilename,
        ]
      );
      res.render("ajout_produit", {
        message: "✅ Produit ajouté avec succès !",
      });
    } catch (err) {
      console.error("Erreur ajout produit:", err);
      res.status(500).render("ajout_produit", {
        message: "❌ Erreur ajout dans la base de données",
      });
    }
  }
);

// Création d'agent (réservé admin)
app.get("/inscription_agent", authMiddleware, isAdmin, (req, res) =>
  res.render("inscription_agent", { message: null })
);

app.post("/inscription_agent", authMiddleware, isAdmin, async (req, res) => {
  const { login, password, nom, prenom, email } = req.body;
  if (!login || !password)
    return res.render("inscription_agent", { message: "Champs requis" });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, ?, ?, ?, '2000-01-01', ?, 'agent')",
      [login, hash, nom, prenom, email]
    );
    res.render("inscription_agent", { message: "Agent créé" });
  } catch (err) {
    res
      .status(500)
      .render("inscription_agent", { message: "Erreur création agent" });
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
