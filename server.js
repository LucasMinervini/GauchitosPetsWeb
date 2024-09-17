const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);
const productRoutes = require('./routes/productsRoutes'); // Asegúrate de que esta ruta existe
require('dotenv').config();
const crypto = require('crypto');
const multer = require('multer');
const productController = require('./controllers/productsController');
const fs = require('fs');
const app = express();
const port = 1234; // Puedes cambiarlo a 1234 si lo prefieres


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

// Rutas de productos externas
app.use('/api', productRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
