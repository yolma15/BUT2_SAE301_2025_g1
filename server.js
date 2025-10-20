import express from "express";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import pool from "./db.js";
import session from "express-session";
import bodyParser from "body-parser";

const app = express();
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Note: secure should be true in production with HTTPS
  })
);

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/home", function (req, res) {
  res.render("home");
});

app.use(express.static("public"));

app.get("/login", async (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  let login = req.body.login;
  let password = req.body.password;
  if (login && password) {
    pool.query(
      "SELECT * FROM utilisateur WHERE login = ? AND password = ?",
      [login, password],
      (error, results) => {
        if (results[0].length > 0) {
          req.session.userRole = results[0][0].role;
          req.session.userId = results[0][0].id;
          req.session.loggedin = true;
          req.session.login = login;
          res.redirect("/home");
        } else {
          res.render("login", { message: "Incorrect login and/or Password!" });
        }
        res.end();
      }
    );
  } else {
    res.send("Please enter login and Password!");
    res.end();
  }
});

app.use((req, res) => {
  res.status(404).render("404");
});

app.listen(3000);
