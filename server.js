const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const port = 1234;


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

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Datos de productos
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
  db.get("SELECT stock FROM products WHERE id = ?", [id], (err, row) => {
    if (err) {
      res.status(500).send('Error executing query');
      return;
    }
    if (!row || row.stock < quantity) {
      res.status(400).send('Not enough stock');
      return;
    }
    const newStock = row.stock - quantity;
    db.run("UPDATE products SET stock = ? WHERE id = ?", [newStock, id], (err) => {
      if (err) {
        res.status(500).send('Error updating stock');
        return;
      }
      res.send('Purchase successful');
    });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
