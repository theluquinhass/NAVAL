import express from 'express'
import controller from '../controllers/financeController.js'

const router = express.Router()

router.get('/finance/summary', controller.getFinanceSummaryController)
router.get('/finance/payments', controller.getPaymentsController)
router.post('/finance/payments', controller.postPaymentController)
router.post('/finance/refunds', controller.postRefundController)
router.get('/finance/expenses', controller.getExpensesController)
router.post('/finance/expenses', controller.postExpenseController)
router.put('/finance/expenses/:id', controller.putExpenseController)
router.get('/finance/categories', controller.getCategoriesController)
router.post('/finance/categories', controller.postCategoryController)
router.put('/finance/categories/:id', controller.putCategoryController)
router.delete('/finance/categories/:id', controller.deleteCategoryController)

export default router
