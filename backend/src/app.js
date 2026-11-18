import authMiddleware from './middlewares/authMiddleware.js'
import express from 'express'

const app = express()

app.use(express.json())

app.get('/profile', authMiddleware, (req, res) =>{
    res.json({
        message: 'Acesso Liberado',
        user: {
            id: req.user.id,
            email : req.user.email
        }
    })
})

export default app