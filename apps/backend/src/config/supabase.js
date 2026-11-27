import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY


export const supabase = createClient(supabaseUrl, supabaseKey)

export const createUserClient = (token) => {
    return createClient(supabaseUrl,supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    })
}

export const createPublicClient = () => createClient(supabaseUrl, supabaseKey)

