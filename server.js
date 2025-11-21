import express from "express";
import path from "path";
import ejs from "ejs";
import session from "express-session";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import pool from "./db.js"; // Base de données
//import produitModel from "./models/produitModel.js"; // Import d’un modèle dédié (à créer si manquant)

const app = express();

// Configuration moteur de template
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

// Middleware de base
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Gestion de session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // à mettre sur true en HTTPS production
  })
);

//Expose session data to EJS views
app.use((req, res, next) => {
  res.locals.isLoggedIn = Boolean(req.session?.userId);
  res.locals.userRole = req.session?.userRole || null;    // 'client' | 'agent' | 'admin' | null
  res.locals.username = req.session?.username || null;    // affiché dans le header
  next();
});

// Middleware d’authentification
function authMiddleware(req, res, next) {
  if (req.session?.userId) return next();
  return res.status(403).redirect("/login");
}

// Middleware administrateur
function isAdmin(req, res, next) {
  if (req.session?.userRole === "admin") return next();
  return res.status(403).redirect("/home");
}

function isAgent(req, res, next) {
  if (req.session?.userRole === "agent") return next();
  return res.status(403).redirect("/home");
}

// Routes principales
app.get("/", (req, res) => res.render("home"));
app.get("/home", (req, res) => res.render("home"));
app.get("/register", (req, res) => res.render("register"));
app.get("/login", (req, res) => res.render("login"));
app.get("/locations", (req, res) => res.render("locations"));
app.get("/catalogue", async (req, res) => {
  try {
    // Vérifiez que produitModel est bien importé et a la méthode getAllProduits
    // const produits = await produitModel.getAllProduits();
    // res.render("catalogue", { produits });
    res.render("catalogue", { produits: [] }); // Utilisation temporaire si produitModel non disponible
  } catch (err) {
    console.error("Erreur produits :", err);
    res.status(500).render("catalogue", { produits: [] });
  }
});
app.get("/product", async (req, res) => {
  try {
    // Vérifiez que produitModel est bien importé et a la méthode getAllProduits
    // const produits = await produitModel.getAllProduits();
    // res.render("product", { produits });
    res.render("product", { produits: [] }); // Utilisation temporaire si produitModel non disponible
  } catch (err) {
    console.error("Erreur produits :", err);
    res.status(500).render("product", { produits: [] });
  }
});

// Pages secondaires
app.get("/ajout_produit", isAdmin, (req, res) => res.render("ajout_produit"));
app.get("/locations", authMiddleware, (req, res) => res.render("locations"));
app.get("/returnprod", authMiddleware, (req, res) => res.render("returnprod"));
app.get("/inscription_agent", isAdmin, (req, res) => res.render("inscription_agent"));

//Mes locations: redirige vers login si non connecté
app.get('/mes-locations', (req, res) => {
  if (!req.session?.userId) {
    req.session.postLoginRedirect = '/mes-locations';
    return res.redirect('/login');
  }
  return res.render('mes_locations'); // crée/ajuste la vue correspondante
});

// Profil client (GET: afficher, POST: modifier)
app.get('/profil', async (req, res) => {
  // Vérification de l'authentification et du rôle
  if (!req.session?.userId) return res.redirect('/login');
  if (req.session.userRole !== 'client') return res.redirect('/');

  try {
    // 1. Requête pour récupérer toutes les infos de l'utilisateur
    // CORRECTION CRITIQUE: Utilisation de 'ddn' au lieu de 'date_naissance'
    const [results] = await pool.query(
      "SELECT nom, prenom, login, ddn, photo_url, email FROM utilisateur WHERE id = ?",
      [req.session.userId]
    );

    if (results.length === 0) {
      // Ceci ne devrait pas arriver si l'ID de session est valide, mais par sécurité
      return res.status(404).send("Profil utilisateur non trouvé.");
    }

    // 2. Récupération des données utilisateur
    const user = results[0];

    // 3. Rendu du template en passant l'objet sous le nom 'utilisateur' pour compatibilité EJS
    return res.render('profil', { utilisateur: user });

  } catch (e) {
    console.error('Erreur récupération profil:', e);
    // Afficher une erreur générique sans exposer le détail de l'erreur à l'utilisateur
    return res.status(500).send("Erreur interne du serveur lors du chargement du profil.");
  }
});

app.post('/profil', async (req, res) => {
  if (!req.session?.userId || req.session.userRole !== 'client') return res.redirect('/');
  try {
    // Mise à jour des champs nom, prenom, email, ddn
    const { nom, prenom, email, ddn } = req.body;
    
    // NOTE: Il manque la colonne photo_url pour la modification
    await pool.query(
      'UPDATE utilisateur SET nom=?, prenom=?, email=?, ddn=? WHERE id=?', 
      [nom, prenom, email, ddn, req.session.userId]
    );
    
    return res.redirect('/profil');
  } catch (e) {
    console.error('Erreur update profil:', e);
    // La vue 'profil' attend un objet 'utilisateur', si l'update échoue, on doit le fournir.
    // Pour simplifier, on redirige, mais en cas d'erreur grave, il faudrait refaire le SELECT.
    return res.status(500).send("Erreur interne lors de la mise à jour du profil.");
  }
});

// === Logout commun ===
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// Route de connexion
app.post("/login", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.render("login", { message: "Veuillez saisir vos identifiants." });
  }

  try {
    // Requête corrigée avec les vrais noms de champs
    const [results] = await pool.query(
      "SELECT id, login, nom, prenom, type_utilisateur FROM utilisateur WHERE login = ? AND password = MD5(?)",
      [login, password]
    );

    if (results.length > 0) {
      const user = results[0];
      req.session.userId = user.id;
      req.session.userRole = user.type_utilisateur;    // 'client' / 'agent' / 'admin'
      req.session.username = user.login;             // ou user.prenom si préféré
      req.session.loggedin = true;

      const nextUrl = req.session.postLoginRedirect || "/home";
      delete req.session.postLoginRedirect;
      return res.redirect(nextUrl);
    } else {
      return res.render("login", { message: "Identifiant ou mot de passe incorrect !" });
    }
  } catch (error) {
    console.error("Erreur login :", error);
    return res.status(500).render("login", { message: "Erreur interne du serveur." });
  }
});



// Middleware 404
app.use((req, res) => res.status(404).render("404"));

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));