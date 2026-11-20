import express from 'express'
import cors from 'cors'

import authMiddleware from './middlewares/authMiddleware.js'

const app = express()

app.use(cors({
    origin: 'http://localhost:5173'
}))

app.use(express.json())

app.get('/profile', authMiddleware, (req, res) => {
    res.json({
        message: 'Acesso Liberado',
        user: {
            id: req.user.id,
            email: req.user.email
        }
    })
})

export default app