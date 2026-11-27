import { createUserClient } from '../config/supabase.js'
import { getBarbershopIdForAuthenticatedUser } from './barbershopService.js'

const SERVICES_TABLE = 'services'
const SERVICE_COLUMNS = 'id, name, description, price, duration'

export async function listServices(token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)
    const { data, error } = await supabase
        .from(SERVICES_TABLE)
        .select(SERVICE_COLUMNS)
        .eq('profile_id', profileId)

    if (error) throw new Error('SERVICE_LIST_FAILED')
    return data
}

export async function createService(payload, token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)

    const { data, error } = await supabase
        .from(SERVICES_TABLE)
        .insert({
            profile_id: profileId,
            name: payload.name,
            description: payload.description,
            price: payload.price,
            duration: payload.duration
        })
        .select(SERVICE_COLUMNS)
        .single()

    if (error) throw new Error('SERVICE_CREATE_FAILED')
    return data
}

export async function updateService(serviceId, payload, token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)

    const { data, error } = await supabase
        .from(SERVICES_TABLE)
        .update({
            name: payload.name,
            description: payload.description,
            price: payload.price,
            duration: payload.duration
        })
        .eq('id', serviceId)
        .eq('profile_id', profileId)
        .select(SERVICE_COLUMNS)
        .maybeSingle()

    if (error) throw new Error('SERVICE_UPDATE_FAILED')
    if (!data) throw new Error('SERVICE_NOT_FOUND')
    return data
}

export async function deleteService(serviceId, token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)

    const { data, error } = await supabase
        .from(SERVICES_TABLE)
        .delete()
        .eq('id', serviceId)
        .eq('profile_id', profileId)
        .select('id')
        .maybeSingle()

    if (error) throw new Error('SERVICE_DELETE_FAILED')
    if (!data) throw new Error('SERVICE_NOT_FOUND')
    return data
}
