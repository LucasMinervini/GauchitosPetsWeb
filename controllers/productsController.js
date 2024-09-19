const { error } = require('console');
const db = require('../bd.js');
const crypto = require('crypto');
const z = require('zod');
const { validateProd } = require('../schema/product.js'); 
const { ValidatePartialProd } = require('../schema/product.js');
const mercadopago = require('mercadopago'); 
const bcrypt = require('bcrypt');



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
          success: "http://localhost:1234/api/feedback",
          failure: "http://localhost:1234/api/feedback",
          pending: "http://localhost:1234/api/feedback"
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





const handlePaymentFeedback = (req, res) => {
  const { payment_id, status, merchant_order_id } = req.query; // parámetros recibidos de MercadoPago

  if (!payment_id || !merchant_order_id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  if (status === 'approved') {
    // Actualiza el estado de la orden en la base de datos
    const updateOrderStatusQuery = "UPDATE orders SET status = 'completed' WHERE id = ?";
    
    db.query(updateOrderStatusQuery, [merchant_order_id], (err, result) => {
      if (err) {
        return res.status(500).send('Error al actualizar el estado de la orden');
      }
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pago Exitoso</title>
          <script>
            alert("¡El pago se ha realizado con éxito!");
            setTimeout(function(){
              window.location.href = "/index.html"; // Redirigir después de 3 segundos
            }, 3000);
          </script>
        </head>
        <body>
          <h1>Pago Exitoso</h1>
          <p>Redirigiendo a la página principal...</p>
        </body>
        </html>
      `);
    });
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pago Fallido</title>
        <script>
          alert("El pago no se pudo completar. Por favor, intente nuevamente.");
          setTimeout(function(){
            window.location.href = "/checkout.html"; // Redirigir a checkout después de 3 segundos
          }, 3000);
        </script>
      </head>
      <body>
        <h1>Pago Fallido</h1>
        <p>Redirigiendo a la página principal...</p>
      </body>
      </html>
    `);
  }
};



//Registar usuario

const registerUser = (req, res) =>{
  const { email, password, name, address, phone } = req.body;
  

  if (!email || !password || !name) {
    return res.status(400).send('Email, password, and name are required');
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).send('Error hashing password');
    }

    const query = `
      INSERT INTO users (email, password, name, address, phone, user_type_id) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const user_type_id = 1;

    db.query(query, [email, hash, name, address, phone, user_type_id], (err, results) => {
      if (err) {
        console.error('Error inserting user:', err);
        return res.status(500).send('Server error');
      }

      // Redirigir al usuario a la página de inicio
      res.status(200).json({ message: 'User registered successfully', redirectUrl: '/index.html' });
    });
  });
}


// Login Usuario
const loginUser = (req, res) => {
  const { email, password } = req.body;
  
  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      return res.status(500).send('Server error');
    }
    if (results.length === 0) {
      return res.status(400).send('User not found');
    }

    const user = results[0];
    
    // Comparar contraseñas
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        return res.status(500).send('Error comparing passwords');
      }
      if (!match) {
        return res.status(400).send('Incorrect password');
      }

      // Guardar la información del usuario en la sesión
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.name = user.name;

      // Buscar si hay una orden pendiente
      const orderQuery = 'SELECT * FROM orders WHERE user_id = ? AND status = "pending"';
      db.query(orderQuery, [user.id], (err, orderResult) => {
        if (err) {
          return res.status(500).send('Error al buscar la orden');
        }

        // Si hay una orden pendiente, retornarla
        if (orderResult.length > 0) {
          const pendingOrder = orderResult[0];
          res.json({ message: 'Login exitoso', userId: user.id, pendingOrder });
        } else {
          res.json({ message: 'Login exitoso', userId: user.id });
        }
      });
    });
  });
};

// add- to order
const addToOrder = (req, res) => {
  const { productId, quantity } = req.body;
  let orderId;

  if (req.session && req.session.userId) {
    const userId = req.session.userId;

    // Verificar si el usuario tiene una orden pendiente
    const query = 'SELECT * FROM orders WHERE user_id = ? AND status = "pending"';
    db.query(query, [userId], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error al recuperar la orden' });
      }

      if (result.length > 0) {
        // Orden pendiente encontrada, usar el orderId existente
        orderId = result[0].id;
        insertOrderItem(orderId);
      } else {
        // No hay orden pendiente, crear una nueva
        const newOrderQuery = 'INSERT INTO orders (user_id, status) VALUES (?, "pending")';
        db.query(newOrderQuery, [userId], (err, newOrderResult) => {
          if (err) {
            return res.status(500).json({ message: 'Error al crear la nueva orden' });
          }

          orderId = newOrderResult.insertId;
          req.session.orderId = orderId; // Guardar en sesión
          insertOrderItem(orderId);
        });
      }
    });
  } else {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  function insertOrderItem(orderId) {
    const orderItemQuery = 'INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)';
    db.query(orderItemQuery, [orderId, productId, quantity], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error al agregar producto a la orden' });
      }
      res.status(200).json({ message: 'Producto agregado a la orden', orderId });
    });
  }
};

//completar comprar
const completePurchase = async (req, res) => {
  const { items, total, customerInfo } = req.body;
  let userId;

  try {
      // Verificar si el usuario está logueado
      if (req.session && req.session.userId) {
          // Usuario logueado, usar su ID
          userId = req.session.userId;
      } else {
          // Usuario no logueado, insertar como nuevo cliente en la tabla users
          const insertCustomerQuery = 'INSERT INTO users (name, email) VALUES (?, ?)';
          const [customerResult] = await db.promise().query(insertCustomerQuery, [customerInfo.name, customerInfo.email]);
          userId = customerResult.insertId;  // Usar este ID como user_id en la tabla orders
      }

      // Insertar la orden
      const insertOrderQuery = 'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)';
      const [orderResult] = await db.promise().query(insertOrderQuery, [userId, total, 'Success']);
      const orderId = orderResult.insertId;

      // Insertar los items de la orden
      const insertOrderItemsQuery = 'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES ?';
      const orderItemsData = items.map(item => [orderId, item.id, item.name, item.quantity, item.price]);

      await db.promise().query(insertOrderItemsQuery, [orderItemsData]);

      // Respuesta exitosa
      res.status(201).json({ message: 'Compra realizada con éxito', orderId });
  } catch (err) {
      console.error('Error al procesar la compra:', err);
      res.status(500).json({ message:  err.message });
  }
};


// LogOut
const logOutUser = (req,res) =>{
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    res.redirect('/');
  });
}


// Obtener informacion de la cuenta
const getAccountInfo = (req, res) => {
  const query = 'SELECT name, email, address, phone, user_type_id FROM users WHERE id = ?';
  db.query(query, [req.session.userId], (err, results) => {
      if (err) {
          console.error('Error fetching account info:', err.message);
          return res.status(500).send('Server error');
      }
      if (results.length === 0) {
          return res.status(404).send('User not found');
      }

      const user = results[0];
      res.json({
          name: user.name,
          email: user.email,
          address: user.address,
          phone: user.phone,
          user_type_id: user.user_type_id
      });
  });
};


// CREAR PRODUCTO
const createProduct = (req, res) => {
  // Imprimir los datos recibidos para verificar
  console.log('Datos recibidos:', req.body);
  console.log('Archivos recibidos:', req.files);  // Verificar si las imágenes están llegando

  const { name, sku, description, retail_price, cost, stock_quantity, category, provider_id, weight, orderedImages } = req.body;

  // Validar que orderedImages sea un array válido
  let parsedOrderedImages;
  try {
      parsedOrderedImages = JSON.parse(orderedImages);
      
  } catch (err) {
      console.error('Error al parsear orderedImages:', err);
      return res.status(400).json({ error: 'orderedImages no es un JSON válido' });
  }

  // Procesar los archivos de imágenes
  let imageUrls = [];
  if (Array.isArray(req.files) && req.files.length > 0) {
      imageUrls = req.files.map(file => {
          if (!file.mimetype.startsWith('image/')) {
              return res.status(400).json({ error: 'Solo se permiten archivos de imagen.' });
          }
          return `/images/${file.filename}`;
      });
  }

  // Verificar si hay imágenes
  if (imageUrls.length === 0) {
      return res.status(400).json({ error: 'No se han subido imágenes.' });
  }

  // Eliminar duplicados de las URLs de imágenes y validar que no excedan el límite
  const uniqueImageUrls = [...new Set(imageUrls.map(url => url.trim()))];
  if (uniqueImageUrls.length > 8) {
      return res.status(400).json({ error: 'No se pueden subir más de 8 imágenes.' });
  }

  // Verificar si el proveedor existe
  const providerQuery = 'SELECT id FROM providers WHERE id = ?';
  db.query(providerQuery, [provider_id], (err, providerResults) => {
      if (err || providerResults.length === 0) {
          return res.status(400).json({ error: 'provider_id no válido' });
      }

      // Crear un nuevo ID único para el producto
      const newId = crypto.randomUUID();
      const insertProductQuery = `
        INSERT INTO products (id, name, sku, description, retail_price, cost, stock_quantity, category, provider_id, image_url, weight) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Insertar el producto en la base de datos
      db.query(insertProductQuery, [newId, name, sku, description, retail_price, cost, stock_quantity, category, provider_id, JSON.stringify(uniqueImageUrls), weight], (err, results) => {
          if (err) {
              console.error('Error al insertar el producto:', err);
              return res.status(500).json({ error: err.message });
          }

          // Insertar las categorías del producto
          const insertCategoryQuery = `
            INSERT INTO product_categories (product_id, category_id) 
            VALUES (?, ?)
          `;

          let categoryIds = req.body.category_id;
          if (typeof categoryIds === 'string') {
              categoryIds = JSON.parse(categoryIds);
          }
          if (!Array.isArray(categoryIds)) {
              categoryIds = [categoryIds];
          }

          let categoryErrors = false;
          let processedCategories = 0;

          categoryIds.forEach((categoryId) => {
              db.query(insertCategoryQuery, [newId, categoryId], (err) => {
                  processedCategories++;

                  if (err) {
                      console.error('Error al insertar la categoría:', err.message);
                      categoryErrors = true;
                  }

                  if (processedCategories === categoryIds.length) {
                      if (categoryErrors) {
                          return res.status(500).json({ error: 'Error al insertar algunas categorías.' });
                      }

                      // Seleccionar todas las categorías del producto
                      const selectCategoriesQuery = `
                        SELECT category_id FROM product_categories WHERE product_id = ?
                      `;
                      db.query(selectCategoriesQuery, [newId], (err, categoryResults) => {
                          if (err) {
                              console.error('Error al obtener categorías:', err);
                              return res.status(500).json({ error: err.message });
                          }

                          const categories = categoryResults.map(row => row.category_id);
                          console.log("Producto creado exitosamente con ID: ", newId);
                          // Respuesta exitosa con el ID del producto y la lista de imágenes
                          res.status(201).json({ id: newId, name, sku, description, retail_price, cost, stock_quantity, category, provider_id, image_urls: uniqueImageUrls, category_ids: categories, weight });
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
  
  // Asegurarse de que el parámetro 'name' esté definido
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'El nombre del producto es requerido' });
  }

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

  // Pasar el nombre con los comodines
  db.query(query, [`%${name}%`], (err, results) => {
      if (err) {
          console.error('Error ejecutando la búsqueda:', err);
          return res.status(500).json({ error: 'Error ejecutando la búsqueda' });
      }

      if (results.length === 0) {
          return res.status(404).json({ message: 'No se encontraron productos' });
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
      p.weight,
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
      name,
      weight
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
  const productId = req.params.id;

  const query = `
    SELECT 
      category,
      product_id,
      brand,
      nutritional_info,
      expiry_date,
      age,
      pet_size,
      medicated_food,
      flavor,
       material,
       size,
       dimensions
    FROM product_technical_details
    WHERE product_id = ?
    LIMIT 1;`

  db.query(query, [productId], (error, results) => {
      if (error) {
          return res.status(500).send(error);
      }
      if (results.length === 0) {
          return res.status(404).json({ message: 'Ficha técnica no encontrada' });
      }
      let fichaTecnica = results[0];  // Devuelve los detalles técnicos como JSON

      // Get presentations if exists
      const presentationQuery = `
      SELECT *
      FROM product_presentations
      WHERE product_id = ?;`
      db.query(presentationQuery, [productId], (error, presentations) => {
        if (error) {
            return res.status(500).send(error);
        }
        fichaTecnica.presentations =  presentations ?? [];
        res.json(fichaTecnica);  // Devuelve los detalles técnicos como JSON
      });
  });
}


// Controlador para crear una ficha técnica según la categoría del producto
const createFichaTecnica = (req, res) => {
  

  const {
    category,
    product_id,
    brand,
    nutritional_info, 
    expiry_date,
    age, 
    pet_size, 
    medicated_food = 0, 
    presentation = [], 
    flavor,
    material,
    size,
    dimensions
  } = req.body;

  // Validación de campos obligatorios
  if (!product_id || !brand) {
    return res.status(400).send('Product ID y Brand son requeridos');
  }

  // Crear consulta base de inserción
  let insertQuery = `
    INSERT INTO product_technical_details 
    (product_id, brand, category
  `;
  let queryParams = [product_id, brand, category];

  // Agregar campos según la categoría
  switch (category.toLowerCase().trim()) {
    case 'alimentos':
      insertQuery += ', nutritional_info, expiry_date, age, pet_size, medicated_food, material, size, dimensions, flavor';
      queryParams.push(nutritional_info, expiry_date, age, pet_size, medicated_food, material, size, dimensions, flavor);
      break;
    case 'ropa':
      insertQuery += ', material, size';
      queryParams.push(material, size);
      break;
    case 'accesorios':
      insertQuery += ', dimensions';
      queryParams.push(dimensions);
      break;
    default:
      return res.status(400).send('Categoría de producto no reconocida');
  }

  insertQuery += ') VALUES (?, ?, ?, ?' + ', ?'.repeat(queryParams.length - 4) + ')';

  // Ejecutar la consulta de inserción principal
  db.query(insertQuery, queryParams, (err, results) => {
    if (err) {
      console.error('Error al insertar la ficha técnica:', err);
      return res.status(500).send('Error al insertar la ficha técnica');
    }

    // Insertar las presentaciones si existen
    if (presentation.length > 0) {
      const presentationInsertQuery = 'INSERT INTO product_presentations (product_id, presentation) VALUES (?, ?)';
      presentation.forEach(pres => {
        db.query(presentationInsertQuery, [product_id, pres], (err) => {
          if (err) {
            console.error('Error al insertar la presentación:', err);
          }
        });
      });
    }

    // Devolver los detalles insertados basados en la categoría
    let responseData = {
      id: results.insertId,
      product_id,
      brand,
      category
    };

    // Agregar campos dependiendo de la categoría
    if (category.toLowerCase().trim() === 'alimentos') {
      responseData = {
        ...responseData,
        nutritional_info,
        expiry_date,
        age,
        pet_size,
        medicated_food,
        material,
        size,
        dimensions
      };
    } else if (category.toLowerCase().trim() === 'ropa') {
      responseData = {
        ...responseData,
        material,
        size
      };
    } else if (category.toLowerCase().trim() === 'accesorios') {
      responseData = {
        ...responseData,
        dimensions
      };
    }

    // Enviar respuesta
    res.status(201).send(responseData);
  });
};

//Actualizar producto
const updateProduct = (req, res) => {
  console.log('Datos recibidos para actualización:', req.body);
  console.log('Archivo recibido para actualización:', req.file); // Aquí debería aparecer la imagen principal

  const { id } = req.params;
  const { name, sku, description, retail_price, cost, stock_quantity, category, provider_id, weight } = req.body;

  // Procesar la nueva imagen principal si existe
  let mainImageUrl = null;
  if (req.file) {
    mainImageUrl = `/images/${req.file.filename}`;
  }

  // Si no se proporciona un archivo de imagen, mantenemos las imágenes actuales
  db.query('SELECT image_url FROM products WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error obteniendo las imágenes del producto:', err);
      return res.status(500).send('Error obteniendo las imágenes del producto');
    }

    let currentImages = results.length > 0 && results[0].image_url ? JSON.parse(results[0].image_url) : [];

    // Si se ha proporcionado una nueva imagen principal, reemplazamos la primera
    if (mainImageUrl) {
      currentImages[0] = mainImageUrl; // Reemplazar solo la primera imagen (la imagen principal)
    }

    // Eliminar duplicados de las URLs de imágenes y validar que no excedan el límite
    const uniqueImageUrls = [...new Set(currentImages.map(url => url.trim()))];
    if (uniqueImageUrls.length > 8) {
      return res.status(400).json({ error: 'No se pueden tener más de 8 imágenes.' });
    }

    // Crear un array para almacenar los campos que deben actualizarse
    let fields = [];
    let values = [];

    // Solo agregar los campos que fueron proporcionados
    if (name) {
      fields.push('name = ?');
      values.push(name);
    }
    if (sku) {
      fields.push('sku = ?');
      values.push(sku);
    }
    if (description) {
      fields.push('description = ?');
      values.push(description);
    }
    if (retail_price) {
      fields.push('retail_price = ?');
      values.push(retail_price);
    }
    if (cost) {
      fields.push('cost = ?');
      values.push(cost);
    }
    if (stock_quantity) {
      fields.push('stock_quantity = ?');
      values.push(stock_quantity);
    }
    if (category) {
      fields.push('category = ?');
      values.push(category);
    }
    if (provider_id) {
      fields.push('provider_id = ?');
      values.push(provider_id);
    }
    if (weight) {
      fields.push('weight = ?');
      values.push(weight);
    }

    // Siempre agregar las imágenes actualizadas
    fields.push('image_url = ?');
    values.push(JSON.stringify(uniqueImageUrls));

    // Construir la consulta SQL dinámica
    const updateProductQuery = `
      UPDATE products 
      SET ${fields.join(', ')}
      WHERE id = ?
    `;

    values.push(id); // Agregar el ID al final para la condición WHERE

    db.query(updateProductQuery, values, (err, results) => {
      if (err) {
        console.error('Error al actualizar el producto:', err);
        return res.status(500).json({ error: err.message });
      }

      res.status(200).json({
        message: 'Producto actualizado exitosamente',
        id,
        name,
        sku,
        description,
        retail_price,
        cost,
        stock_quantity,
        category,
        provider_id,
        image_urls: uniqueImageUrls,
        weight
      });
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


//Verificar si esta logeado
const checkLogin = (req,res) =>{
  if (req.session && req.session.userId) {
    // Si existe una sesión con userId, el usuario está logueado
    res.json({ loggedIn: true });
    } else {
    // Si no hay sesión, el usuario no está logueado
    res.json({ loggedIn: false });
   }
}

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
          db.promise().query(orderQuery, [userId, totalAmount, 'pending'], (err, result) => {
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
  createFichaTecnica,
  loginUser,
  getAccountInfo,
  registerUser,
  addToOrder,
  completePurchase,
  handlePaymentFeedback,
  logOutUser,
  checkLogin
};
