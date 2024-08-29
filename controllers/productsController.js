const { error } = require('console');
const db = require('../bd.js');
const crypto = require('crypto');
const z = require('zod');
const { validateProd } = require('../schema/product.js'); 
const { ValidatePartialProd } = require('../schema/product.js');
const mercadopago = require('mercadopago'); // Asegúrate de requerir Mercado Pago


// Configura el Access Token
mercadopago.configure({
  access_token: 'APP_USR-1221336083666937-012620-3941044529350138e64a7055ed4ca37f-541732240'
});

const createPreference = (req, res) => {
  

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
  console.log(req.body);
  console.log(req.files);

  const result = validateProd(req.body);

  if (!result.success) {
      return res.status(422).json({ error: result.error.errors.map(e => e.message).join(', ') });
  }

  const { name, sku, description, retail_price, cost, stock_quantity, provider_id } = result.data;

  // Asegúrate de que category_ids sea un array de enteros
  let categoryIds = req.body.category_id;
  if (typeof categoryIds === 'string') {
      categoryIds = JSON.parse(categoryIds);
  }
  if (!Array.isArray(categoryIds)) {
      categoryIds = [categoryIds];
  }
  categoryIds = categoryIds.map(id => parseInt(id, 10));

  let imageUrls = [];
  if (Array.isArray(req.files) && req.files.length > 0) {
      imageUrls = req.files.map(file => `/images/${file.filename}`);
  } else if (req.files && req.files.filename) {
      imageUrls = [`/images/${req.files.filename}`];
  }

  const concatenatedImageUrls = imageUrls.join(',');

  const providerQuery = 'SELECT id FROM providers WHERE id = ?';
  db.query(providerQuery, [provider_id], (err, providerResults) => {
      if (err || providerResults.length === 0) {
          return res.status(400).send('Invalid provider_id');
      }

      const newId = crypto.randomUUID();
      const insertProductQuery = `
          INSERT INTO products (id, name, sku, description, retail_price, cost, stock_quantity, provider_id, image_url) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(insertProductQuery, [newId, name, sku, description, retail_price, cost, stock_quantity, provider_id, concatenatedImageUrls], (err, results) => {
          if (err) {
              console.error('Error executing query:', err);
              return res.status(500).send('Error executing query');
          }

          // Insertar en la tabla product_categories
          const insertCategoryQuery = `
              INSERT INTO product_categories (product_id, category_id) 
              VALUES (?, ?)
          `;

          let categoryErrors = false;
          let processedCategories = 0;

          categoryIds.forEach((categoryId) => {
              db.query(insertCategoryQuery, [newId, categoryId], (err, results) => {
                  processedCategories++;

                  if (err) {
                      console.error('Error inserting category:', err);
                      categoryErrors = true;
                  }

                  if (processedCategories === categoryIds.length) {
                      if (categoryErrors) {
                          return res.status(500).send('Error inserting one or more categories');
                      }

                      // Recuperar las categorías para devolverlas en la respuesta
                      const selectCategoriesQuery = `
                          SELECT category_id FROM product_categories WHERE product_id = ?
                      `;
                      db.query(selectCategoriesQuery, [newId], (err, categoryResults) => {
                          if (err) {
                              console.error('Error fetching categories:', err);
                              return res.status(500).send('Error fetching categories');
                          }

                          const categories = categoryResults.map(row => row.category_id);
                          console.log("Product created successfully with ID: ", newId);
                          res.status(201).send({ id: newId, ...result.data, image_urls: imageUrls, category_ids: categories });
                      });
                  }
              });
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

// Obtener un producto por nombre
const getProductByName = (req, res) => {
  const { name } = req.query;
  const query = `
      SELECT 
          id, 
          name, 
          retail_price, 
          image_url 
      FROM 
          products 
      WHERE 
          LOWER(name) LIKE LOWER(?) 
      LIMIT 10`;

  db.query(query, [`%${name}%`], (err, results) => {
      if (err) {
          console.error('Error ejecutando la búsqueda:', err);
          res.status(500).json({ error: 'Error ejecutando la búsqueda' });
          return;
      }

      if (results.length === 0) {
          res.status(404).json({ message: 'No se encontraron productos' });
          return;
      }

      res.json(results);  // Devuelve los productos como JSON
  });
};

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
      console.error('Error ejecutando la consulta:', err);
      res.status(500).send('Error ejecutando la consulta');
      return;
    }
    
    if (results.length === 0) {
      console.log('Producto no encontrado para el ID:', id);
      res.status(404).send('Producto no encontrado');
      return;
    }
    
    // Parsear las URLs de las imágenes antes de devolver el producto
    const product = results[0];
    if (product.image_urls) {
      product.image_urls = JSON.parse(product.image_urls);
    }
    
    console.log('Producto encontrado:', product);
    res.status(200).json(product);
  });
};
// Obtener detalles de producto
const getDetailsById = (req, res) => {
  const { id } = req.params;

  // Modificar la consulta para seleccionar solo los campos necesarios
  const query = `
    SELECT 
      retail_price, 
      description, 
      image_url, 
      name 
    FROM 
      products 
    WHERE 
      id = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error ejecutando la consulta:', err);
      res.status(500).send('Error ejecutando la consulta');
      return;
    }
    
    if (results.length === 0) {
      console.log('Producto no encontrado para el ID:', id);
      res.status(404).send('Producto no encontrado');
      return;
    }
    
    console.log('Producto encontrado:', results[0]);
    res.status(200).json(results[0]); // Devuelve solo los campos seleccionados
  });
};

// FICHA TECNICA POR PRODUCTO
const getFichaTecnica = (req, res) => {
  const productId = req.params.id;  // Cambiado para coincidir con la ruta

  const query = `SELECT * FROM product_technical_details WHERE product_id = ?`;

  db.query(query, [productId], (error, results) => {
      if (error) {
          return res.status(500).send(error);
      }
      if (results.length === 0) {
          return res.status(404).json({ message: 'Ficha técnica no encontrada' });
      }
      res.json(results[0]);  // Devuelve los detalles técnicos como JSON
  });
}

// Controlador para crear una ficha técnica según la categoría del producto
const createFichaTecnica = (req, res) => {
  const { category, product_id, brand } = req.body;

  let insertQuery = 'INSERT INTO product_technical_details (product_id, brand';
  let queryParams = [product_id, brand];

  switch (category) {
      case 'alimentos':
          const { nutritional_info, expiry_date } = req.body;
          insertQuery += ', nutritional_info, expiry_date';
          queryParams.push(nutritional_info, expiry_date);
          break;

      case 'ropa':
          const { material, size } = req.body;
          insertQuery += ', material, size';
          queryParams.push(material, size);
          break;

      case 'accesorios':
          const { dimensions } = req.body;
          insertQuery += ', dimensions';
          queryParams.push(dimensions);
          break;

      default:
          return res.status(400).send('Categoría de producto no reconocida');
  }

  insertQuery += ') VALUES (?, ?, ?' + ', ?'.repeat(queryParams.length - 2) + ')';

  db.query(insertQuery, queryParams, (err, results) => {
      if (err) {
          console.error('Error al insertar la ficha técnica:', err);
          return res.status(500).send('Error al insertar la ficha técnica');
      }
      res.status(201).send({ message: 'Ficha técnica creada exitosamente', id: results.insertId });
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
//Insertar order
const createOrder = async (req, res) => {
  const { userId, cartItems, totalAmount } = req.body;

  console.log('Datos recibidos:', { userId, cartItems, totalAmount });

  try {
      
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
  createPreference,
  getDetailsById,
  getFichaTecnica,
  createFichaTecnica
};
