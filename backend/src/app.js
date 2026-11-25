import express from 'express'
import cors from 'cors'

import { createUserClient } from './config/supabase.js'
import authMiddleware from './middlewares/authMiddleware.js'
import barbershopRoutes from './routes/barbershopRoutes.js'
import serviceRoutes from './routes/serviceRoutes.js'
import schedulingRoutes from './routes/schedulingRoutes.js'
import publicBookingRoutes from './routes/publicBookingRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import financeRoutes from './routes/financeRoutes.js'

const app = express()

app.use(cors({
    origin: 'http://localhost:5173'
}))

app.use(express.json())
app.use(publicBookingRoutes)
app.use(authMiddleware, barbershopRoutes)
app.use(authMiddleware, serviceRoutes)
app.use(authMiddleware, schedulingRoutes)
app.use(authMiddleware, customerRoutes)
app.use(authMiddleware, financeRoutes)

app.get('/profile', authMiddleware, async (req, res) => {
    const supabase = createUserClient(req.accessToken)
    const { data, error } = await supabase
        .from('barbershops')
        .select('*')
        .eq('user_id', req.user.id)
        .maybeSingle()

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
