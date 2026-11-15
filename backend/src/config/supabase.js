import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { urlencoded } from 'express'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY


export const supabase = createClient(supabaseUrl, supabaseKey)

