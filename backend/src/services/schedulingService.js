import { createPublicClient, createUserClient } from '../config/supabase.js'
import { getBarbershopIdForUser } from './barbershopService.js'

const TIME_ZONE = 'America/Fortaleza'
const HOURS_TABLE = 'barbershop_working_hours'
const APPOINTMENTS_TABLE = 'appointments'

function localDateTimeToIso(date, time) {
    return new Date(`${date}T${time}-03:00`).toISOString()
}

function dateDayOfWeek(date) {
    return new Date(`${date}T12:00:00-03:00`).getUTCDay()
}

export async function getWorkingHours(token, userId) {
    const profileId = await getBarbershopIdForUser(token, userId)
    const { data, error } = await createUserClient(token)
        .from(HOURS_TABLE)
        .select('id, day_of_week, opens_at, closes_at')
        .eq('profile_id', profileId)
        .order('day_of_week')

    if (error) throw new Error('WORKING_HOURS_READ_FAILED', { cause: error })
    return data
}

export async function saveWorkingHours(token, userId, rows) {
    const profileId = await getBarbershopIdForUser(token, userId)
    const supabase = createUserClient(token)
    let data = []
    if (rows.length > 0) {
        const { data: saved, error } = await supabase
            .from(HOURS_TABLE)
            .upsert(rows.map((row) => ({ ...row, profile_id: profileId })), { onConflict: 'profile_id,day_of_week' })
            .select('id, day_of_week, opens_at, closes_at')
            .order('day_of_week')
        if (error) throw new Error('WORKING_HOURS_SAVE_FAILED', { cause: error })
        data = saved
    }

    let deleteQuery = supabase.from(HOURS_TABLE).delete().eq('profile_id', profileId)
    if (rows.length > 0) {
        deleteQuery = deleteQuery.not('day_of_week', 'in', `(${rows.map((row) => row.day_of_week).join(',')})`)
    }
    const { error: deleteError } = await deleteQuery
    if (deleteError) throw new Error('WORKING_HOURS_SAVE_FAILED', { cause: deleteError })
    return data
}

async function getPublicBarbershop(slug) {
    const { data, error } = await createPublicClient().rpc('get_public_barbershop', { p_slug: slug })
    if (error) throw new Error('PUBLIC_BARBERSHOP_LOOKUP_FAILED', { cause: error })
    if (!data?.length) throw new Error('BARBERSHOP_NOT_FOUND')
    return data[0]
}

export async function getPublicBookingData(slug, date, serviceId) {
    const supabase = createPublicClient()
    const barbershop = await getPublicBarbershop(slug)
    const [{ data: services, error: servicesError }, { data: hours, error: hoursError }] = await Promise.all([
        supabase.from('services').select('id, name, description, price, duration').eq('profile_id', barbershop.id).order('name'),
        supabase.from(HOURS_TABLE).select('day_of_week, opens_at, closes_at').eq('profile_id', barbershop.id)
    ])
    if (servicesError || hoursError) throw new Error('PUBLIC_BOOKING_DATA_FAILED', { cause: servicesError || hoursError })

    const service = services.find((item) => item.id === serviceId)
    const hoursForDay = hours.find((item) => item.day_of_week === dateDayOfWeek(date))
    if (!service || !hoursForDay) return { barbershop, services, slots: [] }

    const { data: busyTimes, error: busyError } = await supabase.rpc('get_public_busy_times', {
        p_slug: slug,
        p_date: date
    })
    if (busyError) throw new Error('PUBLIC_AVAILABILITY_FAILED', { cause: busyError })

    const slots = []
    const durationMs = service.duration * 60_000
    const opening = localDateTimeToIso(date, hoursForDay.opens_at.slice(0, 5))
    const closing = localDateTimeToIso(date, hoursForDay.closes_at.slice(0, 5))
    for (let start = new Date(opening).getTime(); start + durationMs <= new Date(closing).getTime(); start += durationMs) {
        const end = start + durationMs
        if (start <= Date.now()) continue
        if ((busyTimes ?? []).some((busy) => start < new Date(busy.ends_at).getTime() && end > new Date(busy.starts_at).getTime())) continue
        slots.push(new Date(start).toISOString())
    }
    return { barbershop, services, slots }
}

export async function createPublicAppointment(slug, payload) {
    const supabase = createPublicClient()
    const barbershop = await getPublicBarbershop(slug)
    const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, duration')
        .eq('id', payload.serviceId)
        .eq('profile_id', barbershop.id)
        .maybeSingle()
    if (serviceError) throw new Error('SERVICE_LOOKUP_FAILED', { cause: serviceError })
    if (!service) throw new Error('SERVICE_NOT_FOUND')

    const startsAt = new Date(payload.startsAt)
    if (startsAt.getTime() <= Date.now()) throw new Error('SLOT_UNAVAILABLE')
    const endsAt = new Date(startsAt.getTime() + service.duration * 60_000)
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(startsAt)
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const { data: hours, error: hoursError } = await supabase
        .from(HOURS_TABLE)
        .select('opens_at, closes_at')
        .eq('profile_id', barbershop.id)
        .eq('day_of_week', weekdays.indexOf(weekday))
        .maybeSingle()
    if (hoursError) throw new Error('WORKING_HOURS_READ_FAILED', { cause: hoursError })
    if (!hours) throw new Error('SLOT_UNAVAILABLE')

    const startLocal = new Date(startsAt.toLocaleString('en-US', { timeZone: TIME_ZONE }))
    const endLocal = new Date(endsAt.toLocaleString('en-US', { timeZone: TIME_ZONE }))
    const asMinutes = (date) => date.getHours() * 60 + date.getMinutes()
    const toMinutes = (time) => {
        const [hour, minute] = time.split(':').map(Number)
        return hour * 60 + minute
    }
    const opensAtMinutes = toMinutes(hours.opens_at)
    const closesAtMinutes = toMinutes(hours.closes_at)
    const startsAtMinutes = asMinutes(startLocal)
    const endsAtMinutes = asMinutes(endLocal)
    const withinBusinessHours = startsAtMinutes >= opensAtMinutes && endsAtMinutes <= closesAtMinutes
    if (!withinBusinessHours) {
        throw new Error('SLOT_UNAVAILABLE')
    }

    const { error } = await supabase.from(APPOINTMENTS_TABLE).insert({
        profile_id: barbershop.id,
        service_id: service.id,
        customer_name: payload.customerName.trim(),
        customer_phone: payload.customerPhone.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'confirmed'
    })
    if (error?.code === '23P01') throw new Error('SLOT_TAKEN')
    if (error) throw new Error('APPOINTMENT_CREATE_FAILED', { cause: error })
    return { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), status: 'confirmed' }
}

export async function listAppointments(token, userId, from, to) {
    const profileId = await getBarbershopIdForUser(token, userId)
    const { data, error } = await createUserClient(token)
        .from(APPOINTMENTS_TABLE)
        .select('id, customer_name, customer_phone, starts_at, ends_at, status, service:services(id, name, price, duration)')
        .eq('profile_id', profileId)
        .gte('starts_at', from)
        .lt('starts_at', to)
        .order('starts_at')
    if (error) throw new Error('APPOINTMENTS_READ_FAILED', { cause: error })
    return data
}
