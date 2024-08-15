// routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productsController');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images/'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Renombrar archivo para evitar conflictos
  }
});

const upload = multer({ storage: storage });

// Crear un nuevo producto con imagen
router.post('/products', upload.single('image'), productController.createProduct);

// Obtener todos los productos
router.get('/products', productController.getAllProducts);

// Obtener un producto por NOMBRE
router.get('/products/:name', productController.getProductByName);

// Obtener un producto por ID
router.get('/products/:id', productController.getProductById);

// Actualizar un producto por ID
router.patch('/products/:id', productController.updateProduct);

// Eliminar un producto por ID
router.delete('/products/:id', productController.deleteProductById);

// Obtener precio del producto
router.get('/price/:id', productController.getPriceProductById);

// Obtener producto por categoría
router.get('/categories/:category_id', productController.getCategory);

module.exports = router;
