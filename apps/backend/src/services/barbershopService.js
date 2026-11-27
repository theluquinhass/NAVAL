import { createUserClient } from "../config/supabase.js";

const TABLE = 'barbershops'
const PROFILE_COLUMNS = 'id, name, barberName:barber_name, slug, phone, sellsProducts:sells_products'
const PROFILE_CACHE_TTL_MS = 30_000
const MAX_ENTRIES = 500

const profileCache = new Map()

function cachedProfileId(userId) {
    const entry = profileCache.get(userId)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
        profileCache.delete(userId)
        return null
    }
    return entry.profileId
}

function rememberProfileId(userId, profileId) {
    profileCache.delete(userId)
    profileCache.set(userId, {
        profileId,
        expiresAt: Date.now() + PROFILE_CACHE_TTL_MS
    })
    while (profileCache.size > MAX_ENTRIES) {
        profileCache.delete(profileCache.keys().next().value)
    }
}

export function clearProfileCache() {
    profileCache.clear()
}

export default async function createProfileService(payload, token) {
    const supabase = createUserClient(token)
    const { data, error } = await supabase
        .from(TABLE)
        .insert(payload)
        .select()
        .single()

    if (error) throw new Error(error.message)
    profileCache.delete(payload.user_id)
    return data
}

export async function getBarbershopIdForUser(token, userId) {
    const supabase = createUserClient(token)
    return getBarbershopIdForAuthenticatedUser(supabase, userId)
}

export function findProfileForUser(supabase, userId) {
    return supabase
        .from(TABLE)
        .select(PROFILE_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()
}

export async function updateProfileForUser(supabase, userId, payload) {
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)
    const { data, error } = await supabase
        .from(TABLE)
        .update({
            barber_name: payload.barberName,
            name: payload.name,
            phone: payload.phone,
            slug: payload.slug,
            sells_products: payload.sellsProducts
        })
        .eq('id', profileId)
        .eq('user_id', userId)
        .select(PROFILE_COLUMNS)
        .maybeSingle()

    if (error) throw new Error('PROFILE_UPDATE_FAILED', { cause: error })
    if (!data) throw new Error('BARBERSHOP_NOT_FOUND')

    profileCache.delete(userId)
    return data
}

export async function getBarbershopIdForAuthenticatedUser(supabase, userId) {
    const cached = cachedProfileId(userId)
    if (cached) return cached

    const { data, error } = await supabase
        .from('barbershops')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw new Error('BARBERSHOP_LOOKUP_FAILED', { cause: error })
    if (!data) throw new Error('BARBERSHOP_NOT_FOUND')
    rememberProfileId(userId, data.id)
    return data.id
}
