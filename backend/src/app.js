import express from 'express'
import cors from 'cors'

import { createUserClient } from './config/supabase.js'
import authMiddleware from './middlewares/authMiddleware.js'
import { requestTiming } from './middlewares/timing.js'
import { findProfileForUser } from './services/barbershopService.js'
import barbershopRoutes from './routes/barbershopRoutes.js'
import serviceRoutes from './routes/serviceRoutes.js'
import schedulingRoutes from './routes/schedulingRoutes.js'
import publicBookingRoutes from './routes/publicBookingRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import financeRoutes from './routes/financeRoutes.js'
import productRoutes from './routes/productRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'

const app = express()

app.use(cors({
    origin: 'http://localhost:5173'
}))

app.use(express.json())
app.use(requestTiming)
app.use(publicBookingRoutes)
app.use(authMiddleware, barbershopRoutes)
app.use(authMiddleware, serviceRoutes)
app.use(authMiddleware, schedulingRoutes)
app.use(authMiddleware, customerRoutes)
app.use(authMiddleware, financeRoutes)
app.use(authMiddleware, productRoutes)
app.use(authMiddleware, dashboardRoutes)

app.get('/profile', authMiddleware, async (req, res) => {
    const { data, error } = await findProfileForUser(createUserClient(req.accessToken), req.user.id)

    if (error) {
        return res.status(500).json({
            error: 'Erro ao buscar Perfil'
        })
    }

    return res.status(200).json({
        profile: data
    })

})

export default app
