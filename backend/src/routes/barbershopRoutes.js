import express from 'express'
import barbershopController from '../controllers/barbershopController.js'

const router = express.Router()

router.post('/profile', barbershopController.createProfile)

export default router