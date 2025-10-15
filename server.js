import express from "express";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import pool from "./db.js";

const app = express();
app.set("view engine", "ejs");

app.get("/", async function(req, res) {
  let data = await pool.query("SELECT * FROM utilisateur");
  console.log(data);
  res.render("index", {liste_user: data[0]});
});

app.get("/home", (req, res) => {
  res.render("home");
});

app.get('/catalogue', async (req, res) => {
    try {
        const produits = await produitModel.getAllProduits();
        res.render('catalogue', { produits });
    } catch (err) {
        console.error('Erreur lors de la récupération des produits :', err);
        res.render('catalogue', { produits: [] });
    }
});

app.get("/home", (req, res) => {
  res.render("home");
});

app.use((req, res) => {
  res.status(404).render("404");
});





app.listen(3000);