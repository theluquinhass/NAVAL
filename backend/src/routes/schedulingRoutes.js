import express from 'express'
import controller from '../controllers/schedulingController.js'

const router = express.Router()

router.get('/working-hours', controller.getWorkingHoursController)
router.put('/working-hours', controller.putWorkingHoursController)
router.get('/appointments', controller.getAppointmentsController)

export default router
