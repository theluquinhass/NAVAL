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