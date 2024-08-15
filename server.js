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
  const { email, password, name } = req.body;
  
  console.log('Received data:', { email, password, name }); // Verifica los datos recibidos

  if (!password) {
    return res.status(400).send('Password is required');
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).send('Error hashing password');
    }

    const query = 'INSERT INTO users (email, password, name) VALUES (?, ?, ?)';
    db.query(query, [email, hash, name], (err, results) => {
      if (err) {
        console.error('Error inserting user:', err);
        return res.status(500).send('Server error');
      }
      res.send('User registered successfully');
    });
  });
});

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
        return res.status(400).send('Incorrect password');
      }

      // Iniciar sesión y almacenar la información del usuario en la sesión
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.name = user.name; // Asumiendo que tienes un campo 'name' en tu tabla de usuarios

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



// Ruta para obtener datos de productos (Ejemplo de implementación simple)
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

//Ruta para cerra session
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    res.redirect('/login');
  });
});


// Ruta protegida del dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Ruta para obtener la información de la cuenta del usuario
app.get('/account-info', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Unauthorized');
  }

  const query = 'SELECT name, email FROM users WHERE id = ?';
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
      email: user.email
    });
  });
});

app.get('/account', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
