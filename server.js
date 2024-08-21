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
  if (!req.session.userId) {
      return res.status(401).send('Unauthorized');
  }

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
      // Verificar qué datos se están enviando
      console.log('User data:', user); // Agrega este log para verificar los datos
      res.json({
          name: user.name,
          email: user.email,
          address: user.address,
          phone: user.phone,
          user_type_id: user.user_type_id
      });
  });
});


app.get('/account', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
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
      console.log('Usuario logueado, ID:', userId);
      insertOrder(userId);
  } else {
      // Usuario no logueado, insertar como nuevo cliente en la tabla customers
      const insertCustomerQuery = 'INSERT INTO customers (name, email) VALUES (?, ?)';
      db.query(insertCustomerQuery, [customerInfo.name, customerInfo.email], (err, customerResult) => {
          if (err) {
              console.error('Error insertando cliente:', err);
              return res.status(500).json({ message: 'Error al procesar la compra: cliente' });
          }

          userId = customerResult.insertId;  // Usar este ID como user_id en la tabla orders
          console.log('Nuevo cliente insertado, ID:', userId);
          insertOrder(userId);
      });
  }

  function insertOrder(userId) {
      // Asegurarse de que userId es válido antes de proceder
      if (!userId) {
          console.error('userId inválido:', userId);
          return res.status(500).json({ message: 'Error al procesar la compra: userId inválido' });
      }

      // Inserta la orden en la tabla orders usando el userId
      const orderQuery = 'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)';
      db.query(orderQuery, [userId, total, 'pending'], (err, orderResult) => {
          if (err) {
              console.error('Error insertando la orden:', err);
              return res.status(500).json({ message: 'Error al procesar la compra: orden' });
          }

          const orderId = orderResult.insertId;

          // Inserta cada artículo de la orden en la tabla order_items, incluyendo product_name
          const orderItemsQuery = 'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES ?';
          const orderItemsData = items.map(item => [orderId, item.id, item.name, item.quantity, item.price]);

          db.query(orderItemsQuery, [orderItemsData], (err, itemsResult) => {
              if (err) {
                  console.error('Error insertando artículos de la orden:', err);
                  return res.status(500).json({ message: 'Error al procesar la compra: artículos' });
              }

              res.status(201).json({ message: 'Compra realizada con éxito', orderId: orderId });
          });
      });
  }
});


// Endpoint to handle feedback from Mercado Pago
app.get('/feedback', function (req, res) {
  const paymentInfo = {
      payment_id: req.query.payment_id,
      status: req.query.status,
      merchant_order_id: req.query.merchant_order_id
  };

  // Here, you might want to handle the order processing, 
  // like saving to the database or updating the order status.

  res.json(paymentInfo);
});



// Ruta protegida del dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
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

const upload = multer({ storage: storage });

// Integrar multer en la ruta que crea un nuevo producto
app.post('/api/products', upload.single('image'), productController.createProduct);

// Rutas de productos externas
app.use('/api', productRoutes);
// Ruta para servir la página de registro
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
