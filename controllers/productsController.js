const { error } = require('console');
const db = require('../bd.js');
const crypto = require('crypto');
const z = require('zod');
const { validateProd } = require('../schema/product.js'); 
const { ValidatePartialProd } = require('../schema/product.js');
const mercadopago = require('mercadopago'); // Asegúrate de requerir Mercado Pago


// Configura el Access Token
mercadopago.configure({
  access_token: 'APP_USR-589186678721132-082016-cdc4325df4801f0f63adff9503c1dc6b-164054209'
});

const createPreference = (req, res) => {
  console.log('Request Body:', JSON.stringify(req.body, null, 2));

  const items = req.body.items;

  // Verificar que cada item tenga un unit_price numérico
  for (const item of items) {
      if (typeof item.unit_price !== 'number' || isNaN(item.unit_price)) {
          console.error(`Invalid unit_price for item: ${JSON.stringify(item)}`);
          return res.status(400).json({ error: "Invalid unit_price: must be a valid number" });
      }
  }

  // Crear la preferencia con los detalles correctos
  mercadopago.preferences.create({
      items: items,  // Aquí se envían los detalles de cada producto
      back_urls: {
          success: "http://localhost:8080/feedback",
          failure: "http://localhost:8080/feedback",
          pending: "http://localhost:8080/feedback"
      },
      auto_return: "approved",
  })
  .then(response => {
      res.json({ id: response.body.id });
  })
  .catch(error => {
      console.error("Error creating preference: ", error);
      res.status(500).json({ error: "Failed to create payment preference" });
  });
};


// Controlador para crear un producto
const createProduct = (req, res) => {
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);

  const result = validateProd(req.body);

  if (!result.success) {
      return res.status(422).json({ error: result.error.errors.map(e => e.message).join(', ') });
  }

  const { name, sku, description, retail_price, cost, stock_quantity, provider_id, category_id } = result.data;
  const imageUrl = req.file ? `/images/${req.file.filename}` : null;

  const providerQuery = 'SELECT id FROM providers WHERE id = ?';

  db.query(providerQuery, [provider_id], (err, providerResults) => {
      if (err || providerResults.length === 0) {
          return res.status(400).send('Invalid provider_id');
      }

      const newId = crypto.randomUUID();
      const insertQuery = `
          INSERT INTO products (id, name, sku, description, retail_price, cost, stock_quantity, provider_id, image_url) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(insertQuery, [newId, name, sku, description, retail_price, cost, stock_quantity, provider_id, imageUrl], (err, results) => {
          if (err) {
              console.error('Error executing query:', err);
              return res.status(500).send('Error executing query');
          }

          const categoryInsertQuery = 'INSERT INTO product_categories (product_id, category_id) VALUES ?';
          const categoryValues = category_id.map(catId => [newId, catId]);

          db.query(categoryInsertQuery, [categoryValues], (err) => {
              if (err) {
                  console.error('Error inserting categories:', err.sqlMessage || err.message);
                  return res.status(500).send('Error inserting categories');
              }

              res.status(201).send({ id: newId, ...result.data, image_url: imageUrl });
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

//UPDATE de producto
const updateProduct = (req, res) => {

  // Validar la entrada parcial del producto
  const result = ValidatePartialProd(req.body);

  if (!result.success) {
    return res.status(422).json({ error: result.error.errors.map(e => e.message).join(', ') });
  }
  
  const { id } = req.params; // ID del producto
  const updates = req.body;

  // Verificar que haya campos para actualizar
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
  }

  // Procesar campos de actualización
  const fields = Object.keys(updates).filter(key => key !== 'category_id').map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates).filter(value => !Array.isArray(value));

  // Iniciar la transacción
  db.beginTransaction(err => {
    if (err) {
      console.error('Error iniciando la transacción:', err);
      return res.status(500).send('Error iniciando la transacción');
    }

    const updateQuery = `
        UPDATE products 
        SET ${fields}
        WHERE id = ?
    `;

    db.query(updateQuery, [...values, id], (err, results) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error ejecutando la consulta de actualización:', err);
          res.status(500).send('Error ejecutando la consulta');
        });
      }

      // Si el campo category_id está presente y es un array, actualizarlo
      if (updates.category_id && Array.isArray(updates.category_id)) {
        const deleteQuery = `DELETE FROM product_categories WHERE product_id = ?`;
        const insertQuery = `INSERT INTO product_categories (product_id, category_id) VALUES ?`;
        const categoryValues = updates.category_id.map(catId => [id, catId]);

        db.query(deleteQuery, [id], (err) => {
          if (err) {
            return db.rollback(() => {
              console.error('Error al eliminar categorías anteriores:', err);
              res.status(500).send('Error eliminando categorías anteriores');
            });
          }

          db.query(insertQuery, [categoryValues], (err) => {
            if (err) {
              return db.rollback(() => {
                console.error('Error al insertar nuevas categorías:', err);
                res.status(500).send('Error insertando nuevas categorías');
              });
            }

            db.commit(err => {
              if (err) {
                return db.rollback(() => {
                  console.error('Error al confirmar la transacción:', err);
                  res.status(500).send('Error confirmando la transacción');
                });
              }

              res.status(200).json({ message: 'Producto actualizado exitosamente, incluyendo categorías' });
            });
          });
        });
      } else {
        db.commit(err => {
          if (err) {
            return db.rollback(() => {
              console.error('Error al confirmar la transacción:', err);
              res.status(500).send('Error confirmando la transacción');
            });
          }

          res.status(200).json({ message: 'Producto actualizado exitosamente' });
        });
      }
    });
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

const createOrder = async (req, res) => {
  const { userId, cartItems, totalAmount } = req.body;

  console.log('Datos recibidos:', { userId, cartItems, totalAmount });

  try {
      // Crear la orden en la base de datos
      const orderQuery = `
          INSERT INTO orders (user_id, total_amount, status) 
          VALUES (?, ?, ?)
      `;
      
      const orderResult = await new Promise((resolve, reject) => {
          db.query(orderQuery, [userId, totalAmount, 'pending'], (err, result) => {
              if (err) {
                  console.error('Error al crear la orden:', err);
                  return reject(err);
              }
              resolve(result);
          });
      });

      const orderId = orderResult.insertId;

      // Insertar cada item en la base de datos
      const itemQuery = `
          INSERT INTO order_items (order_id, product_id, quantity, price) 
          VALUES (?, ?, ?, ?)
      `;

      const orderItemPromises = cartItems.map(item => {
          return new Promise((resolve, reject) => {
              db.query(itemQuery, [orderId, item.productId, item.quantity, item.price], (err, result) => {
                  if (err) {
                      console.error(`Error al insertar el producto ${item.productId} en la orden ${orderId}:`, err);
                      return reject(err);
                  }
                  resolve(result);
              });
          });
      });

      await Promise.all(orderItemPromises);

      res.status(200).json({ message: 'Order placed successfully', orderId });
  } catch (error) {
      console.error('Error placing order:', error);
      res.status(500).send('Server error');
  }
};


module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProductById,
  getProductByName,
  getPriceProductById,
  getCategory,
  createOrder,
  createPreference
};
