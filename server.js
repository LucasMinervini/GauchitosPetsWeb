// server.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const productRoutes = require('./routes/productsRoutes'); // Asegúrate de que esta ruta existe
require('dotenv').config();

const app = express();
const port = 8080; // Puedes cambiarlo a 1234 si lo prefieres

// Conexión a la base de datos MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the MySQL database.');
});

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta para obtener datos de productos (Ejemplo de implementación simple)
app.get('/api/products/:id', (req, res) => {
  const productId = req.params.id;
  const query = 'SELECT * FROM products WHERE id = ?';
  db.query(query, [productId], (err, results) => {
    if (err) {
      console.error('Error fetching product data:', err);
      res.status(500).send('Server error');
      return;
    }
    if (results.length === 0) {
      res.status(404).send('Product not found');
      return;
    }
    res.json(results[0]);
  });
});

// Ruta para manejar la compra de un producto
app.post('/buy', (req, res) => {
  const { id, quantity } = req.body;
  const querySelect = "SELECT stock FROM products WHERE id = ?";
  const queryUpdate = "UPDATE products SET stock = ? WHERE id = ?";
  
  db.query(querySelect, [id], (err, results) => {
    if (err) {
      res.status(500).send('Error executing query');
      return;
    }
    if (!results.length || results[0].stock < quantity) {
      res.status(400).send('Not enough stock');
      return;
    }
    const newStock = results[0].stock - quantity;
    db.query(queryUpdate, [newStock, id], (err) => {
      if (err) {
        res.status(500).send('Error updating stock');
        return;
      }
      res.send('Purchase successful');
    });
  });
});

// Rutas de productos externas
app.use('/api', productRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
