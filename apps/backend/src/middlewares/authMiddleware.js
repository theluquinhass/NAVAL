import { performance } from 'node:perf_hooks'
import { supabase } from '../config/supabase.js'
import { cacheUser, getCachedUser, getTokenExpiryMs } from './authCache.js'
import { addServerTiming } from './timing.js'

// Private symbol: no other middleware can fake an authenticated request by
// setting a plain `authResolved` property. The flag only means this middleware
// has already handled the request (it is mounted for several route groups).
const AUTH_RESOLVED = Symbol('authResolved')

const authMiddleware = async (req, res, next) => {
    if (req[AUTH_RESOLVED]) return next()
    req[AUTH_RESOLVED] = true

    const token = req.headers.authorization

    if (!token || !token.startsWith('Bearer '))
        return res.status(401).json({
            error: 'Acesso negado'
        })

    const jwt = token.split(' ')[1]
    const started = performance.now()

    const jwtExpiry = getTokenExpiryMs(jwt)
    if (jwtExpiry !== null && jwtExpiry <= Date.now() + 1_000) {
        addServerTiming(res, 'auth', performance.now() - started)
        return res.status(401).json({
            error: 'Token Invalido ou expirado!'
        })
    }

    try {
        let user = getCachedUser(jwt)
        if (!user) {
            const { data, error } = await supabase.auth.getUser(jwt)
            if (error) {
                addServerTiming(res, 'auth', performance.now() - started)
                return res.status(401).json({
                    error: 'Token Invalido ou expirado!'
                })
            }
            user = { id: data.user.id }
            cacheUser(jwt, user)
        }

        addServerTiming(res, 'auth', performance.now() - started)
        req.user = user
        req.accessToken = jwt
        next()
    } catch (error) {
        addServerTiming(res, 'auth', performance.now() - started)
        return res.status(500).json({
            error: 'Falha na comunicacao com o supabase'
        })
    }
}
export default authMiddleware
