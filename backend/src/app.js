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

const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
    throw new Error('CORS_ORIGIN é obrigatório em produção: informe uma lista de origens separadas por vírgula.')
}

const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : ['http://localhost:5173']

function isOriginAllowed(origin) {
    return allowedOrigins.includes('*') || allowedOrigins.includes(origin)
}

app.use(cors({
    origin(origin, callback) {
        if (!origin || isOriginAllowed(origin)) return callback(null, true)
        return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'))
    }
}))

app.use(express.json())
app.use(requestTiming)

// Liveness probe for Docker/hosting health checks. Public and registered before the
// auth-protected routers, which would otherwise answer 401.
app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'ok' })
})

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
            error: 'Erro ao buscar Perfil',
            code: 'PROFILE_READ_FAILED'
        })
    }

    return res.status(200).json({
        profile: data
    })

})

app.use((req, res) => {
    return res.status(404).json({ error: 'Rota não encontrada.', code: 'NOT_FOUND' })
})

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)

    if (error?.type === 'entity.parse.failed' || (error instanceof SyntaxError && error.status === 400 && 'body' in error)) {
        return res.status(400).json({ error: 'JSON inválido.', code: 'INVALID_JSON' })
    }
    if (error?.message === 'CORS_ORIGIN_NOT_ALLOWED') {
        return res.status(403).json({ error: 'Origem não permitida.', code: 'CORS_ORIGIN_NOT_ALLOWED' })
    }

    console.error('[app] unhandled error', error?.code ?? '', error?.message ?? '')
    return res.status(500).json({ error: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' })
})

export default app
