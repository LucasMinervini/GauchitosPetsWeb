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

  const { name, sku, description, retail_price, cost, stock_quantity, category_id, provider_id } = result.data; // category_id es ahora un array
  const providerQuery = 'SELECT id FROM providers WHERE id = ?';

  // Verificar si el provider_id es válido
  db.query(providerQuery, [provider_id], (err, providerResults) => {
    if (err || providerResults.length === 0) {
      return res.status(400).send('Invalid provider_id');
    }

    // Genera un UUID para el nuevo producto
    const newId = crypto.randomUUID(); 
    const query = `
      INSERT INTO products (id, name, sku, description, retail_price, cost, stock_quantity, provider_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutar la consulta para insertar el nuevo producto
    db.query(query, [newId, name, sku, description, retail_price, cost, stock_quantity, provider_id], (err, results) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Error executing query');
      }

      // Ahora manejar la inserción en product_categories
      const categoryInsertQuery = 'INSERT INTO product_categories (product_id, category_id) VALUES ?';

      // Preparar los valores para la inserción
      const categoryValues = category_id.map(catId => [newId, catId]);

      db.query(categoryInsertQuery, [categoryValues], (err) => {
        if (err) {
          console.error('Error inserting categories:', err);
          return res.status(500).send('Error inserting categories');
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
// Obtener productos por categoria
const getCategory = (req, res) => {
  const category_id = parseInt(req.params.category_id, 10);

  if (isNaN(category_id)) {
    return res.status(400).send('Invalid category_id');
  }

  // Consulta actualizada para obtener productos basados en la tabla intermedia 'product_categories'
  const query = `
    SELECT 
      p.id,
      p.name,
      p.sku,
      p.description,
      p.retail_price,
      p.cost,
      p.stock_quantity,
      p.provider_id,
      p.created_at,
      p.updated_at,
      p.image_url,
      GROUP_CONCAT(pc.category_id) AS category_ids
    FROM products p
    JOIN product_categories pc ON p.id = pc.product_id
    WHERE pc.category_id = ?
    GROUP BY p.id
  `;

  db.query(query, [category_id], (err, results) => {
    if (err) {
      console.log('Error executing query:', err);
      return res.status(500).send('Error executing query');
    }

    if (results.length === 0) {
      return res.status(404).send('No products found for the given category_id');
    }

    // Mapear los resultados para convertir category_ids en un array
    const formattedResults = results.map(product => ({
      ...product,
      category_ids: product.category_ids ? product.category_ids.split(',').map(Number) : []
    }));

    res.status(200).json(formattedResults);
  });
};

// Obtener precio del producto (retail_price)
const getPriceProductById = (req,res) =>{

  const { id }= req.params;
  db.query('SELECT retail_price FROM products WHERE id = ?',[id],(err,results) => {

  if (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Error executing query');
    return;
  }
  if (results.length === 0) {
    res.status(404).send('Price not found');
    return;
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
  getProductByName,
  getPriceProductById,
  getCategory
};
