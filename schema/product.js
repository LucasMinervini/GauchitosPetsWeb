const z = require('zod');

const productSchema = z.object({
  name: z.string({
    invalid_type_error: 'El nombre tiene que ser un string',
    required_error: 'El nombre es obligatorio'
  }).regex(/^[A-Za-z\s]+$/, {
    message: 'El nombre solo puede contener letras y espacios'
  }),
  sku: z.number({
    message: 'El SKU solo puede contener números'
  }),
  description: z.string(),
  retail_price: z.number({
    invalid_type_error: 'Tiene que ser un número'
  }).min(1),
  cost: z.number().min(1),
  stock_quantity: z.number().min(1),
  category_id: z.array(z.number()).min(1, 'Debes asignar al menos una categoría'),
  provider_id: z.number().positive()
});




function validateProd(object) {
  let parsedObject;

  try {
      parsedObject = {
          ...object,
          sku: parseInt(object.sku, 10),
          retail_price: parseFloat(object.retail_price),
          cost: parseFloat(object.cost),
          stock_quantity: parseInt(object.stock_quantity, 10),
          category_id: Array.isArray(object.category_id) ? object.category_id.map(id => parseInt(id, 10)) : JSON.parse(object.category_id),
          provider_id: parseInt(object.provider_id, 10),
      };

      console.log('Category IDs before validation:', parsedObject.category_id, 'Length:', parsedObject.category_id.length);

      // Validar que el nombre solo contenga letras, números y espacios
      const nameRegex = /^[a-zA-Z0-9\s]+$/;
      if (!nameRegex.test(parsedObject.name)) {
          throw new Error('El nombre solo puede contener letras, números y espacios');
      }

      // Asegurarse de que category_id no esté vacío y es realmente un array
      if (!Array.isArray(parsedObject.category_id) || parsedObject.category_id.length === 0) {
          throw new Error('Debes asignar al menos una categoría');
      }

  } catch (error) {
      return {
          success: false,
          error: {
              errors: [{ message: error.message }]
          }
      };
  }

  return productSchema.safeParse(parsedObject);
}

function ValidatePartialProd(object) {
  return productSchema.partial().safeParse(object);
}

module.exports = {
  validateProd,
  ValidatePartialProd
};
