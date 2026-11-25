import express from 'express'
import controller from '../controllers/customerController.js'

const router = express.Router()

router.get('/customers', controller.getCustomersController)
router.post('/customers', controller.postCustomerController)
router.get('/customers/:id', controller.getCustomerDetailsController)
router.put('/customers/:id', controller.putCustomerController)

export default router
