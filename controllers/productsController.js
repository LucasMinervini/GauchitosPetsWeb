// controllers/productController.js
const db = require('../bd.js');

// Crear un nuevo producto
const createProduct = (req, res) => {
  const { name, price, description, stock } = req.body;
  const query = 'INSERT INTO products (name, price, description, stock) VALUES (?, ?, ?, ?)';
  db.query(query, [name, price, description, stock], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error executing query');
      return;
    }
    res.status(201).send({ id: results.insertId, name, price, description, stock });
  });
};

// Obtener todos los productos
const getAllProducts = (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error executing query');
      return;
    }
    res.status(200).json(results);
  });
};

// Obtener un producto por ID
const getProductById = (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error executing query');
      return;
    }
    if (results.length === 0) {
      res.status(404).send('Product not found');
      return;
    }
    res.status(200).json(results[0]);
  });
};

// Actualizar un producto por ID
const updateProductById = (req, res) => {
  const { id } = req.params;
  const { name, price, description, stock } = req.body;
  const query = 'UPDATE products SET name = ?, price = ?, description = ?, stock = ? WHERE id = ?';
  db.query(query, [name, price, description, stock, id], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error executing query');
      return;
    }
    if (results.affectedRows === 0) {
      res.status(404).send('Product not found');
      return;
    }
    res.status(200).send({ id, name, price, description, stock });
  });
};

// Eliminar un producto por ID
const deleteProductById = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM products WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error executing query');
      return;
    }
    if (results.affectedRows === 0) {
      res.status(404).send('Product not found');
      return;
    }
    res.status(200).send({ id });
  });
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProductById,
  deleteProductById
};
