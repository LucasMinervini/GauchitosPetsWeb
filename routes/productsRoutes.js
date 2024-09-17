// routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productsController');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const imagesDir = path.join(__dirname, '../public/images');
    console.log(imagesDir);
    cb(null, imagesDir); // Guardar la imagen en 'public/images'
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Generar un nombre único para la imagen
  }
});

const upload = multer({
  storage: storage,
  limits: { files: 6 }
});

// Crear un nuevo producto con múltiples imágenes
router.post('/products', upload.array('images', 6), productController.createProduct);

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
