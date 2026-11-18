import axios from 'axios'
import { supabase } from '../lib/supabase'

const api = axios.create({
    baseURL: "http://localhost:3000"
})

api.interceptors.request.use(async () =>{
    try{    
        const {data: {session}, error} = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
            return console.error("Token ivalido")
        }
    } catch (error) {
        console.error("Erro ao buscar Sessao")
    }
})

export default api

