// controllers/productController.js
const db = require('../bd.js');

// Crear un nuevo producto
const createProduct = (req, res) => {
  const { name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id } = req.body;

  // Verificar si category_id y provider_id existen en sus respectivas tablas
  const categoryQuery = 'SELECT id FROM categories WHERE id = ?';
  const providerQuery = 'SELECT id FROM providers WHERE id = ?';

  db.query(categoryQuery, [category_id], (err, categoryResults) => {
    if (err || categoryResults.length === 0) {
      res.status(400).send('Invalid category_id');
      return;
    }

    db.query(providerQuery, [provider_id], (err, providerResults) => {
      if (err || providerResults.length === 0) {
        res.status(400).send('Invalid provider_id');
        return;
      }

      const query = `
        INSERT INTO products (name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(query, [name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id], (err, results) => {
        if (err) {
          console.error('Error executing query:', err);
          res.status(500).send('Error executing query');
          return;
        }
        res.status(201).send({ id: results.insertId, name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id });
      });
    });
  });
};

module.exports = { createProduct };

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
const updateProduct = (req, res) => {
  const { id } = req.params;
  const { name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id } = req.body;

  // Construir la consulta SQL dinámicamente para solo actualizar los campos proporcionados
  let fields = [];
  let values = [];
  
  if (name !== undefined) {
    fields.push("name = ?");
    values.push(name);
  }
  if (sku !== undefined) {
    fields.push("sku = ?");
    values.push(sku);
  }
  if (description !== undefined) {
    fields.push("description = ?");
    values.push(description);
  }
  if (retail_price !== undefined) {
    fields.push("retail_price = ?");
    values.push(retail_price);
  }
  if (cost !== undefined) {
    fields.push("cost = ?");
    values.push(cost);
  }
  if (stock_quantity !== undefined) {
    fields.push("stock_quantity = ?");
    values.push(stock_quantity);
  }
  if (category_id !== undefined) {
    fields.push("category_id = ?");
    values.push(category_id);
  }
  if (provider_id !== undefined) {
    fields.push("provider_id = ?");
    values.push(provider_id);
  }

  if (fields.length === 0) {
    res.status(400).send("No fields to update");
    return;
  }

  values.push(id);

  const query = `UPDATE products SET ${fields.join(", ")} WHERE id = ?`;

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Error executing query');
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).send('Product not found');
      return;
    }

    res.status(200).send('Product updated successfully');
  });
};

module.exports = { createProduct, updateProduct };

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
  updateProduct,
  deleteProductById
};
