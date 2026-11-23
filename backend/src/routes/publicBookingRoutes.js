import express from 'express'
import controller from '../controllers/schedulingController.js'

const router = express.Router()

router.get('/booking/:slug/availability', controller.getPublicAvailabilityController)
router.post('/booking/:slug/appointments', controller.postPublicAppointmentController)

export default router
