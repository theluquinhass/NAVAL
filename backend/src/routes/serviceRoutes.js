import express from 'express'
import serviceController from '../controllers/serviceController.js'

const router = express.Router()

router.get('/services', serviceController.getServices)
router.post('/services', serviceController.createService)
router.put('/services/:id', serviceController.updateService)
router.delete('/services/:id', serviceController.deleteService)

export default router
