import { createUserClient } from '../config/supabase.js'

const SERVICES_TABLE = 'services'
const BARBERSHOPS_TABLE = 'barbershops'

async function getBarbershopId(supabase, userId) {
    const { data, error } = await supabase
        .from(BARBERSHOPS_TABLE)
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw new Error('BARBERSHOP_LOOKUP_FAILED')
    if (!data) throw new Error('BARBERSHOP_NOT_FOUND')
    return data.id
}

export async function listServices(token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopId(supabase, userId)
    const { data, error } = await supabase
        .from(SERVICES_TABLE)
        .select('*')
        .eq('profile_id', profileId)

    if (error) throw new Error('SERVICE_LIST_FAILED')
    return data
}

export async function createService(payload, token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopId(supabase, userId)

    const { data, error } = await supabase
        .from(SERVICES_TABLE)
        .insert({
            profile_id: profileId,
            name: payload.name,
            description: payload.description,
            price: payload.price,
            duration: payload.duration
        })
        .select()
        .single()

    if (error) throw new Error('SERVICE_CREATE_FAILED')
    return data
}

export async function updateService(serviceId, payload, token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopId(supabase, userId)

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
        .select()
        .maybeSingle()

    if (error) throw new Error('SERVICE_UPDATE_FAILED')
    if (!data) throw new Error('SERVICE_NOT_FOUND')
    return data
}

export async function deleteService(serviceId, token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopId(supabase, userId)

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
