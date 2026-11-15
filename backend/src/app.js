import express from 'express'
import { supabase } from './config/supabase.js'

const app = express()

app.use(express.json())

app.get('/teste-db', async (req, res) => {
    const { data, error } = await supabase
        .from('barbershops')
        .select('*')
        .limit(1)

    if (error) {
        return res.status(500).json({
            connented: false,
            error: error.message
        })
    }

    return res.json({
        connented: true,
        message: 'Supabase connected successfully'
    })

})

export default app