import express from "express";
import path from "path";
import ejs from "ejs";
import session from "express-session";
import bodyParser from "body-parser";
import pool from "./db.js"; // Base de données
import produitModel from "./models/produitModel.js"; // Import d’un modèle dédié (à créer si manquant)

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

// Routes principales
app.get("/", (req, res) => res.render("home"));
app.get("/home", (req, res) => res.render("home"));
app.get("/register", (req, res) => res.render("register"));
app.get("/login", (req, res) => res.render("login"));
app.get("/catalogue", async (req, res) => {
  try {
    const produits = await produitModel.getAllProduits();
    res.render("catalogue", { produits });
  } catch (err) {
    console.error("Erreur produits :", err);
    res.status(500).render("catalogue", { produits: [] });
  }
});
app.get("/product", async (req, res) => {
  try {
    const produits = await produitModel.getAllProduits();
    res.render("product", { produits });
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

// Route de connexion
app.post("/login", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password)
    return res.render("login", { message: "Veuillez saisir vos identifiants." });

  try {
    const [results] = await pool.query(
      "SELECT * FROM utilisateur WHERE login = ? AND password = ?",
      [login, password]
    );

    if (results.length > 0) {
      const user = results[0];
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.loggedin = true;
      res.redirect("/home");
    } else {
      res.render("login", { message: "Identifiant ou mot de passe incorrect !" });
    }
  } catch (error) {
    console.error("Erreur login :", error);
    res.status(500).render("login", { message: "Erreur interne du serveur." });
  }
});

// Middleware 404
app.use((req, res) => res.status(404).render("404"));

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
