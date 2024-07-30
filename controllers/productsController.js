const { error } = require('console');
const db = require('../bd.js');
const crypto = require('crypto');
const z = require('zod');
const { validateProd } = require('../schema/product.js'); 
const { ValidatePartialProd } = require('../schema/product.js');


// Crear un nuevo producto
const createProduct = (req, res) => {
  const result = validateProd(req.body);

  if (!result.success) {
    return res.status(422).json({ error: result.error.errors.map(e => e.message).join(', ') });
  }
  
  const { name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id } = result.data; // usar result.data
  const categoryQuery = 'SELECT id FROM categories WHERE id = ?';
  const providerQuery = 'SELECT id FROM providers WHERE id = ?';

  // Verificar si el category_id es válido
  db.query(categoryQuery, [category_id], (err, categoryResults) => {
    if (err || categoryResults.length === 0) {
      return res.status(400).send('Invalid category_id');
    }

    // Verificar si el provider_id es válido
    db.query(providerQuery, [provider_id], (err, providerResults) => {
      if (err || providerResults.length === 0) {
        return res.status(400).send('Invalid provider_id');
      }

      // Genera un UUID para el nuevo producto
      const newId = crypto.randomUUID(); 
      const query = `
        INSERT INTO products (id, name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Ejecutar la consulta para insertar el nuevo producto
      db.query(query, [newId, name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id], (err, results) => {
        if (err) {
          console.error('Error executing query:', err);
          return res.status(500).send('Error executing query');
        }
        
        // Retorna la respuesta con el id del nuevo producto y los datos validados
        res.status(201).send({ id: newId, ...result.data });
      });
    });
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
// obtener un producto por nombre
const getProductByName = (req,res) =>{

  const { name } = req.params;
  db.query('SELECT * FROM products WHERE name = ?',[name],(err,results) =>{

    if(err){
      console.log('Error executing query:',err);
      res.status(500).send('Error executing query');
      return;
    }
    if(results.length === 0){
      res.status(404).send('Error executing query');
    }

    res.status(200).json(results[0]);
  })
}

// Obtener un producto por id
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

  // Validar la entrada parcial del producto
  const result = ValidatePartialProd(req.body);

  if (!result.success) {
    return res.status(422).json({ error: result.error.errors.map(e => e.message).join(', ') });
  }
  
  const { id } = req.params;
  const updates = req.body;

  // Verificar que haya campos para actualizar
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
  }

  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);

  const query = `
      UPDATE products 
      SET ${fields}
      WHERE id = ?
  `;

  db.query(query, [...values, id], (err, results) => {
      if (err) {
          console.error('Error executing query:', err);
          res.status(500).send('Error ejecutando la consulta');
          return;
      }

      if (results.affectedRows === 0) {
          res.status(404).send('Producto no encontrado');
          return;
      }

      res.status(200).json({ message: 'Producto actualizado exitosamente' });
  });
};


// Eliminar un producto por ID
const deleteProductById = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM products WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error al ejecutar query', err);
      res.status(500).send('Error al ejecutar query');
      return;
    }
    if (results.affectedRows === 0) {
      res.status(404).send('Producto no encontrado');
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
  deleteProductById,
  getProductByName
};
