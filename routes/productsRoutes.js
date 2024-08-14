// routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productsController');

const router = express.Router();

// Crear un nuevo producto
router.post('/products', productController.createProduct);

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

//Obtener precio del producto
router.get('/price/:id',productController.getPriceProductById);

//Obtener producto por categoria
router.get('/categories/:category_id',productController.getCategory);


module.exports = router;
