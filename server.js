import express from "express";
import path from "path";
import ejs from "ejs";
import session from "express-session";
import bodyParser from "body-parser";
// import bcrypt from "bcrypt"; // Retire Bcrypt pour utiliser MD5 (compatible avec les données existantes)
import pool from "./db.js"; // Base de données
import crypto from "crypto"; 
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
app.get("/inscription_agent", isAdmin, (req, res) =>
  res.render("inscription_agent")
);

//Mes locations: redirige vers login si non connecté
app.get("/mes-locations", (req, res) => {
  if (!req.session?.userId) {
    req.session.postLoginRedirect = "/mes-locations";
    return res.redirect("/login");
  }
  return res.render("mes_locations"); // crée/ajuste la vue correspondante
});


// Fonction pour récupérer les données utilisateur et rendre la page
async function renderProfilPage(req, res, message = null) {
  if (!req.session?.userId) return res.redirect('/login');
  if (req.session.userRole !== 'client') return res.redirect('/');

  try {
    // Requête pour récupérer toutes les infos de l'utilisateur (utilisant 'ddn' et 'photo_url' s'il existe)
    const [results] = await pool.query(
      "SELECT nom, prenom, login, ddn, email FROM utilisateur WHERE id = ?",
      [req.session.userId]
    );

    if (results.length === 0) {
      return res.status(404).send("Profil utilisateur non trouvé.");
    }

    const user = results[0];
    
    // Rendu du template en passant l'objet 'utilisateur' et le message (s'il existe)
    return res.render('profil', { utilisateur: user, message: message });

  } catch (e) {
    console.error('Erreur récupération profil:', e);
    return res.status(500).send("Erreur interne du serveur lors du chargement du profil.");
  }
}

// Profil client (GET: afficher avec gestion des messages)
app.get('/profil', (req, res) => {
    // Utilise une session flash pour stocker temporairement les messages
    const message = req.session.message;
    delete req.session.message;
    renderProfilPage(req, res, message);
});


// POST: Modification des informations personnelles et du mot de passe
app.post('/profil/informations', async (req, res) => {
  if (!req.session?.userId || req.session.userRole !== 'client') return res.redirect('/');
  
  // Le champ 'password' est inclus s'il a été rempli
  const { nom, prenom, email, ddn, password } = req.body;
  
  try {
    // Base de la requête UPDATE pour les champs non-password
    let updateQuery = 'UPDATE utilisateur SET nom=?, prenom=?, email=?, ddn=?';
    let values = [nom, prenom, email, ddn];

    if (password) {
        // Si le champ mot de passe a été rempli (c'est-à-dire non vide)
        if (password.length < 4) { // MD5 n'a pas de contrainte de longueur, mais on s'assure d'une saisie
             req.session.message = { 
                type: 'error', 
                text: "Le nouveau mot de passe est trop court." 
            };
            return res.redirect('/profil');
        }
        
        // Hashing du nouveau mot de passe avec MD5 (pour compatibilité)
        // La fonction MD5 est appliquée directement dans la requête SQL pour l'update.
        updateQuery += ', password=MD5(?)';
        values.push(password); // On push le mot de passe en clair pour que MySQL le hache
    }
    
    // Finalisation de la requête
    updateQuery += ' WHERE id=?';
    values.push(req.session.userId);

    await pool.query(updateQuery, values);
    
    req.session.message = { 
        type: 'success', 
        text: 'Vos informations et/ou votre mot de passe ont été mis à jour avec succès.' 
    };
    return res.redirect('/profil');
    
  } catch (e) {
    console.error('Erreur update informations profil:', e);
    req.session.message = { 
        type: 'error', 
        text: "Erreur lors de la mise à jour des informations. Veuillez réessayer." 
    };
    return res.redirect('/profil');
  }
});


// route de déconnexion
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

// Route d’inscription
app.post("/register", async (req, res) => {
  const { login, password, nom, prenom, ddn, email } = req.body;
  
  // VALIDATION
  if (!login || !password || !nom || !prenom || !ddn || !email) {
    return res.render("register", { message: "Tous les champs sont requis" });
  }
  
  // Hash du mot de passe (maintenant MD5 pour compatibilité)
  // On utilise la fonction MD5(?) directement dans la requête
  
  try {
    await pool.query(
      "INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur) VALUES (?, MD5(?), ?, ?, ?, ?, 'client')",
      [login, password, nom, prenom, ddn, email]
    );
    res.redirect('/login');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.render("register", { message: "Login ou email déjà utilisé" });
    }
    console.error(error);
    res.status(500).render("register", { message: "Erreur serveur" });
  }
});

// Route de connexion
app.post("/login", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.render("login", {
      message: "Veuillez saisir vos identifiants.",
    });
  }

  try {
    // 1. Récupérer l'utilisateur et vérifier le mot de passe (MD5)
    // La vérification se fait directement dans la clause WHERE avec MD5(?)
    const [results] = await pool.query(
      "SELECT id, login, nom, prenom, type_utilisateur FROM utilisateur WHERE login = ? AND password = MD5(?)",
      [login, password]
    );

    if (results.length > 0) {
      const user = results[0];
      
      // Connexion réussie
      req.session.userId = user.id;
      req.session.userRole = user.type_utilisateur;    // 'client' / 'agent' / 'admin'
      req.session.username = user.login;             // ou user.prenom si préféré
      req.session.loggedin = true;

        const nextUrl = req.session.postLoginRedirect || "/home";
        delete req.session.postLoginRedirect;
        return res.redirect(nextUrl);
      }
     else {
      return res.render("login", {
        message: "Identifiant ou mot de passe incorrect !",
      });
    }
  } catch (error) {
    console.error("Erreur login :", error);
    return res
      .status(500)
      .render("login", { message: "Erreur interne du serveur." });
  }
});

// Middleware 404
app.use((req, res) => res.status(404).render("404"));

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));