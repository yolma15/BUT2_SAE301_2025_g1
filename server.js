import express from "express";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import pool from "./db.js";

const app = express();
app.set("view engine", "ejs");

app.use(express.static("public"));

app.get("/", function (req, res) {
  res.render("home");
});

app.use(express.static("public"));

app.get("/catalogue", async (req, res) => {
  try {
    const produits = await produitModel.getAllProduits();
    res.render("catalogue", { produits });
  } catch (err) {
    console.error("Erreur lors de la récupération des produits :", err);
    res.render("catalogue", { produits: [] });
  }
});

app.get("/product", async (req, res) => {
  try {
    const produits = await produitModel.getAllProduits();
    res.render("product", { produits });
  } catch (err) {
    console.error("Erreur lors de la récupération des produits :", err);
    res.render("product", { produits: [] });
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.use((req, res) => {
  res.status(404).render("404");
});

app.listen(3000);
