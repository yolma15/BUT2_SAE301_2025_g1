import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.set("view engine", "ejs");

app.get("/", function (req, res) {
  res.render("index",
     { MAVARIABLE: "Hello World!" });
});

app.use((req, res) => {
  res.status(404).render("404");
});

app.listen(3000);
