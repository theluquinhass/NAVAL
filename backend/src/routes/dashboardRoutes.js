import express from 'express'
import controller from '../controllers/dashboardController.js'

const router = express.Router()

router.get('/dashboard/overview', controller.getDashboardOverviewController)

export default router
