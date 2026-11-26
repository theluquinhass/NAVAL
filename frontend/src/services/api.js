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

export default api

