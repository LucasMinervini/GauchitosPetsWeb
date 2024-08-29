// routes/productRoutes.js
const express = require('express');
const productController = require('../../controllers/productsController');

const router = express.Router();

// Integrar multer en la ruta que crea un nuevo producto
app.post('/api/products', upload.array('images', 6), productController.createProduct);


// Obtener todos los productos
router.get('/products', productController.getAllProducts);

// Obtener un producto por NOMBRE
router.get('/products/search', productController.getProductByName);

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
