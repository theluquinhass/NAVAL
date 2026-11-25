import { createUserClient } from '../config/supabase.js'
import { getBarbershopIdForAuthenticatedUser } from './barbershopService.js'

const CUSTOMERS_TABLE = 'customers'
const APPOINTMENTS_TABLE = 'appointments'

async function getContext(token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)
    return { supabase, profileId }
}

export async function listCustomers(token, userId, search = '') {
    const { supabase, profileId } = await getContext(token, userId)
    let query = supabase
        .from(CUSTOMERS_TABLE)
        .select('id, name, phone, created_at, updated_at')
        .eq('profile_id', profileId)
        .order('name', { ascending: true })
        .limit(500)

    if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) throw new Error('CUSTOMER_LIST_FAILED', { cause: error })
    return data ?? []
}

export async function createCustomer(token, userId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(CUSTOMERS_TABLE)
        .insert({ profile_id: profileId, name: payload.name, phone: payload.phone })
        .select('id, name, phone, created_at, updated_at')
        .single()

    if (error?.code === '23505') throw new Error('CUSTOMER_DUPLICATE', { cause: error })
    if (error) throw new Error('CUSTOMER_CREATE_FAILED', { cause: error })
    return data
}

export async function updateCustomer(token, userId, customerId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(CUSTOMERS_TABLE)
        .update({ name: payload.name, phone: payload.phone })
        .eq('id', customerId)
        .eq('profile_id', profileId)
        .select('id, name, phone, created_at, updated_at')
        .maybeSingle()

    if (error?.code === '23505') throw new Error('CUSTOMER_DUPLICATE', { cause: error })
    if (error) throw new Error('CUSTOMER_UPDATE_FAILED', { cause: error })
    if (!data) throw new Error('CUSTOMER_NOT_FOUND')
    return data
}

export async function getCustomer(token, userId, customerId) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(CUSTOMERS_TABLE)
        .select('id, name, phone, created_at, updated_at')
        .eq('id', customerId)
        .eq('profile_id', profileId)
        .maybeSingle()

    if (error) throw new Error('CUSTOMER_READ_FAILED', { cause: error })
    if (!data) throw new Error('CUSTOMER_NOT_FOUND')
    return data
}

export async function getCustomerAppointments(token, userId, customerId) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(APPOINTMENTS_TABLE)
        .select('id, customer_name, customer_phone, starts_at, ends_at, status, service:services(id, name, price, duration)')
        .eq('profile_id', profileId)
        .eq('customer_id', customerId)
        .order('starts_at', { ascending: false })
        .limit(100)

    if (error) throw new Error('CUSTOMER_HISTORY_FAILED', { cause: error })
    return data ?? []
}
