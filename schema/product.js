const z = require('zod');

const productSchema = z.object({
  name: z.string({
    invalid_type_error: 'El nombre tiene que ser un string',
    required_error: 'El nombre es obligatorio'
  }).regex(/^[A-Za-z\s]+$/, {
    message: 'El nombre solo puede contener letras y espacios'
  }),
  sku: z.number( {
    message: 'El SKU solo puede contener números'
  }),
  description: z.string(),
  retail_price: z.number({
    invalid_type_error: 'Tiene que ser un número'
  }).min(1),
  cost: z.number().min(1),
  stock_quantity: z.number().min(1), // Asegúrate de que sea al menos 1
  category_id: z.number().positive(),
  provider_id: z.number().positive()
});

function validateProd(object) {
  return productSchema.safeParse(object);
}
function ValidatePartialProd(object){
  return productSchema.partial().safeParse(object);
}
module.exports = {
  validateProd,
  ValidatePartialProd
};
