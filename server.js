// server.js
const express = require('express');
const db = require('./bd.js');
const productRoutes = require('./routes/productsRoutes.js');
const bodyParser = require('body-parser');
const path = require('path');


const app = express();
const port = 8080;

app.use(express.json());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname,'public')));

app.get("/", (req,res) => {
  res.sendFile(path.join(__dirname,'public','index.html'));
});

app.use('/api', productRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

