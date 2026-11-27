import express from 'express'
import controller from '../controllers/productController.js'
import { requireSellsProducts } from '../middlewares/requireSellsProducts.js'

const router = express.Router()

// authMiddleware runs before this router in app.js; the flag is checked with
// the authenticated user's client so RLS keeps tenant isolation. The guard is
// attached per route so unrelated endpoints are not affected.
router.get('/products', requireSellsProducts, controller.getProductsController)
router.post('/products', requireSellsProducts, controller.postProductController)
router.put('/products/:id', requireSellsProducts, controller.putProductController)
router.patch('/products/:id/active', requireSellsProducts, controller.patchProductActiveController)
router.delete('/products/:id', requireSellsProducts, controller.deleteProductController)
router.get('/products/movements', requireSellsProducts, controller.getMovementsController)
router.post('/products/movements', requireSellsProducts, controller.postMovementController)
router.get('/products/sales', requireSellsProducts, controller.getSalesController)
router.get('/products/finance/overview', requireSellsProducts, controller.getProductFinanceOverviewController)
router.post('/products/sales', requireSellsProducts, controller.postSaleController)
router.post('/products/sales/:id/refund', requireSellsProducts, controller.postSaleRefundController)

export default router
