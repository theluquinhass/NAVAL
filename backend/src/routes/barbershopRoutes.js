import express from 'express'
import barbershopController from '../controllers/barbershopController.js'

const router = express.Router()

router.post('/profile', barbershopController.createProfile)
router.put('/profile', barbershopController.updateProfile)

export default router