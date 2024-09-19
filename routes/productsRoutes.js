// routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productsController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Verificar que la carpeta 'public/images' exista, si no, crearla
const imagesDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const imagesDir = path.join(__dirname, '../public/images'); // Ruta para guardar las imágenes
    cb(null, imagesDir); // Guardar la imagen en 'public/images'
  },
  filename: (req, file, cb) => {
    // Generar un nombre único utilizando el timestamp y un número aleatorio para evitar colisiones
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Generar un nombre único para la imagen
  }
});

// Configuración de límites y filtro de archivos
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limitar el tamaño de cada archivo a 5MB
    files: 8, // Permitir hasta 8 archivos
    fieldSize: 50 * 1024 * 1024 // Tamaño total de los campos (50MB)
  },
  fileFilter: (req, file, cb) => {
    // Validación de tipo de archivo (solo imágenes)
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes en formato JPEG o PNG'));
    }
  }
});

// Crear un nuevo producto con múltiples imágenes
router.post('/products', upload.array('images', 8), productController.createProduct);


// Actualizar un producto por ID con una nueva imagen principal
router.patch('/products/:id', upload.single('mainImage'), productController.updateProduct);

// Obtener todos los productos
router.get('/products', productController.getAllProducts);

// Obtener un producto por NOMBRE
router.get('/products/:name', productController.getProductByName);

// Obtener un producto por ID
router.get('/products/:id', productController.getProductById);

// Eliminar un producto por ID
router.delete('/products/:id', productController.deleteProductById);

// Obtener precio del producto
router.get('/price/:id', productController.getPriceProductById);

// Obtener producto por categoría
router.get('/categories/:category_id', productController.getCategory);

// Ruta para manejar compras
router.post('/orders', productController.createOrder);

// Crear preferencia de pago
router.post('/products/create_preference', productController.createPreference);

// Obtener detalles de un producto
router.get('/products/details/:id', productController.getDetailsById);

// Obtener ficha técnica de un producto por ID
router.get('/products/fichaTecnica/:id', productController.getFichaTecnica);

// Crear una ficha técnica
router.post('/products/fichaTecnica', productController.createFichaTecnica);

// Login de usuarios
router.post('/login', productController.loginUser);

// Información de la cuenta
router.get('/account-info', productController.getAccountInfo);

// Registrar usuario
router.post('/register', productController.registerUser);

// Agregar productos a la orden
router.post('/add-to-order', productController.addToOrder);

// Completar compra
router.post('/complete-purchase', productController.completePurchase);

// Feedback de compra
router.get('/feedback', productController.handlePaymentFeedback);

// Cerrar sesión
router.get('/logout', productController.logOutUser);

module.exports = router;
