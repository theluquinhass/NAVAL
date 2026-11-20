import { supabase } from '../config/supabase.js'

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization
    
    if (!token || !token.startsWith('Bearer ')) 
        return res.status(401).json({
            error: 'Acesso negado'
        })

    const jwt = token.split(' ')[1]
    
    try {
        const {data, error } = await supabase.auth.getUser(jwt)
        if (error) {
            return res.status(401).json({
                error: 'Token Invalido ou expirado!'
            })
        }
        req.user = data.user
        req.accessToken = jwt
        
        next()
    } catch (error) {
        return res.status(500).json({
            error: 'Falha na comunicacao com o supabase'
        })
    }
}
export default authMiddleware