import axios from 'axios'
import { supabase } from '../lib/supabase'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api'
})

api.interceptors.request.use(async (config) =>{
    if (config.skipAuth) {
        delete config.skipAuth
        return config
    }

    try{     
        const {data: {session}, error} = await supabase.auth.getSession()
        if (error) throw error
        const token = session?.access_token
        
        if(!token){
            return Promise.reject(new Error("Usuario nao autenticado"))
        }
        
        config.headers.Authorization = `Bearer ${token}`
        return config

    } catch (error) {
        return Promise.reject(error)
    }
})

// An authenticated request rejected with 401 means the session is no longer valid
// (revoked token, deleted user). Signing out clears the session, and ProtectedRoute
// then redirects to /login instead of leaving every page stuck on a load error.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const sentToken = Boolean(error.config?.headers?.Authorization)
        if (error.response?.status === 401 && sentToken) {
            try {
                await supabase.auth.signOut({ scope: 'local' })
            } catch (signOutError) {
                console.error('Erro ao encerrar sessao expirada', signOutError)
            }
        }
        return Promise.reject(error)
    }
)

export default api

