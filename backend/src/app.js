import express from 'express'
import cors from 'cors'

import { createUserClient } from './config/supabase.js'
import authMiddleware from './middlewares/authMiddleware.js'
import barbershopRoutes from './routes/barbershopRoutes.js'

const app = express()

app.use(cors({
    origin: 'http://localhost:5173'
}))

app.use(express.json())
app.use(authMiddleware, barbershopRoutes)

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