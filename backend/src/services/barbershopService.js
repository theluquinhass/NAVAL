import { createUserClient } from "../config/supabase.js";

const TABLE = 'barbershops'


export default async function createProfileService(payload, token) {
    const supabase = createUserClient(token)
    const { data, error } = await supabase
        .from(TABLE)
        .insert(payload)
        .select()
        .single()

    if (error) throw new Error(error.message)
    return data
}

export async function getBarbershopIdForUser(token, userId) {
    const supabase = createUserClient(token)
    return getBarbershopIdForAuthenticatedUser(supabase, userId)
}

export async function getBarbershopIdForAuthenticatedUser(supabase, userId) {
    const { data, error } = await supabase
        .from('barbershops')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw new Error('BARBERSHOP_LOOKUP_FAILED', { cause: error })
    if (!data) throw new Error('BARBERSHOP_NOT_FOUND')
    return data.id
}
