const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);
const productRoutes = require('./routes/productsRoutes'); // Asegúrate de que esta ruta existe
require('dotenv').config();
const crypto = require('crypto');
const multer = require('multer');
const productController = require('./controllers/productsController');

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

// Generar una secret key
const secretKey = crypto.randomBytes(64).toString('hex');

// Configuración del almacén de sesiones en la base de datos
const store = new KnexSessionStore({
  knex: require('knex')({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    }
  }),
  tablename: 'sessions', // Nombre de la tabla para almacenar las sesiones
  createtable: true // Crear la tabla si no existe
});

app.use(session({
  secret: secretKey, // Usa la clave secreta generada
  resave: false,
  saveUninitialized: true,
  store: store, // Almacén de sesión configurado con MySQL o cualquier otro que prefieras
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // La cookie de sesión durará 7 días
    secure: false // Cambia esto a true si estás usando HTTPS
  }
}));

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Ruta para servir la página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/register', (req, res) => {
  const { email, password, name, address, phone } = req.body;
  console.log(req.body);

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
});

// Ruta para loguear usuarios
app.post('/login', (req, res) => {
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
        return res.status(400).send('Contraseña incorrecta');
      }

      // Iniciar sesión y almacenar la información del usuario en la sesión
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.name = user.name;

      // Guardar la sesión en la base de datos
      req.session.save(err => {
        if (err) {
          return res.status(500).send('Error saving session');
        }
        // Redirigir a la página de inicio
        res.redirect('/');
      });
    });
  });
});

// Ruta para obtener la información de la cuenta del usuario
app.get('/account-info', (req, res) => {
  const query = 'SELECT name, email, address, phone, user_type_id FROM users WHERE id = ?';
  db.query(query, [req.session.userId], (err, results) => {
      if (err) {
          console.error('Error fetching account info:', err);
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
});

// Ruta para servir la página de consulta.html
app.get('/consulta', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'consulta.html'));
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

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    res.redirect('/');
  });
});

// Ruta para manejar la compra
app.post('/api/complete-purchase', (req, res) => {
  const { items, total, customerInfo } = req.body;

  let userId;

  // Verificar si el usuario está logueado
  if (req.session && req.session.userId) {
      // Usuario logueado, usar su ID
      userId = req.session.userId;
      insertOrder(userId);
  } else {
      // Usuario no logueado, insertar como nuevo cliente en la tabla customers
      const insertCustomerQuery = 'INSERT INTO customers (name, email) VALUES (?, ?)';
      db.query(insertCustomerQuery, [customerInfo.name, customerInfo.email], (err, customerResult) => {
          if (err) {
              return res.status(500).json({ message: 'Error al procesar la compra: cliente' });
          }

          userId = customerResult.insertId;  // Usar este ID como user_id en la tabla orders
          insertOrder(userId);
      });
  }

  function insertOrder(userId) {
      const orderQuery = 'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)';
      db.query(orderQuery, [userId, total, 'success'], (err, orderResult) => {
          if (err) {
              return res.status(500).json({ message: 'Error al procesar la compra: orden' });
          }

          const orderId = orderResult.insertId;

          const orderItemsQuery = 'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES ?';
          const orderItemsData = items.map(item => [orderId, item.id, item.name, item.quantity, item.price]);

          db.query(orderItemsQuery, [orderItemsData], (err, itemsResult) => {
              if (err) {
                  return res.status(500).json({ message: 'Error al procesar la compra: artículos' });
              }

              res.status(201).json({ message: 'Compra realizada con éxito', orderId: orderId });
          });
      });
  }
});

// Nueva ruta para que los usuarios vean sus órdenes
app.get('/api/orders', (req, res) => {
  const userId = req.session.userId;

  const query = `
      SELECT 
          o.id AS order_id,
          o.total_amount,
          o.status,
          o.created_at,
          oi.product_name,
          oi.quantity,
          oi.price
      FROM 
          orders o
      JOIN 
          order_items oi ON o.id = oi.order_id
      WHERE 
          o.user_id = ?
  `;

  db.query(query, [userId], (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Error al obtener las órdenes' });
      }

      res.json(results);
  });
});

// Endpoint to handle feedback from Mercado Pago
app.get('/feedback', function (req, res) {
  const paymentInfo = {
      payment_id: req.query.payment_id,
      status: req.query.status,
      merchant_order_id: req.query.merchant_order_id
  };

  if (req.query.status === 'approved') {
      const updateOrderStatusQuery = "UPDATE orders SET status = 'success' WHERE id = ?";
      db.query(updateOrderStatusQuery, [req.query.merchant_order_id], (err, result) => {
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
                          window.location.href = "/index.html";
                      }, 3000); // Redirigir después de 3 segundos
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
                      window.location.href = "/checkout.html";
                  }, 3000); // Redirigir después de 5 segundos
              </script>
          </head>
          <body>
              <h1>Pago Fallido</h1>
              <p>Redirigiendo a la página principal...</p>
          </body>
          </html>
      `);
  }
});

// Ruta protegida del dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Configuración de almacenamiento para las imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { files: 6 }  // Limita el número de archivos a 6
});

// Integrar multer en la ruta que crea un nuevo producto
app.post('/api/products', upload.array('images', 6), productController.createProduct);

// Rutas de productos externas
app.use('/api', productRoutes);

// Ruta para servir la página de registro
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
