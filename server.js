import express from "express";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import pool from "./db.js";

const app = express();
app.set("view engine", "ejs");

app.get("/", async function(req, res) {
  let data = await pool.query("SELECT * FROM produit");
  console.log(data);
  res.render("index", {data});
});




app.get("/", function (req, res) {
  res.render("home",
     { MAVARIABLE: "Hello World!" });
});

app.use((req, res) => {
  res.status(404).render("404");
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

app.listen(3000);