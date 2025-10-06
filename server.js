import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();

app.get('/', function(req, res) {
    res.sendFile("./index.html", { root: import.meta.dirname });
});

app.use((req,res)=>{
    res.status(404).sendFile("./404.html", { root: import.meta.dirname });
});

app.listen(3000);
