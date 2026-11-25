import express from 'express'
import controller from '../controllers/productController.js'

const router = express.Router()

router.get('/products', controller.getProductsController)
router.post('/products', controller.postProductController)
router.put('/products/:id', controller.putProductController)
router.patch('/products/:id/active', controller.patchProductActiveController)
router.delete('/products/:id', controller.deleteProductController)
router.get('/products/movements', controller.getMovementsController)
router.post('/products/movements', controller.postMovementController)
router.get('/products/sales', controller.getSalesController)
router.get('/products/finance/overview', controller.getProductFinanceOverviewController)
router.post('/products/sales', controller.postSaleController)
router.post('/products/sales/:id/refund', controller.postSaleRefundController)

export default router
