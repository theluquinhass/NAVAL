import { createPublicClient, createUserClient } from '../config/supabase.js'
import { getBarbershopIdForAuthenticatedUser, getBarbershopIdForUser } from './barbershopService.js'

const TIME_ZONE = 'America/Fortaleza'
const HOURS_TABLE = 'barbershop_working_hours'
const APPOINTMENTS_TABLE = 'appointments'
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localDateTimeToIso(date, time) {
    return new Date(`${date}T${time}-03:00`).toISOString()
}

function dateDayOfWeek(date) {
    return new Date(`${date}T12:00:00-03:00`).getUTCDay()
}

function timeToMinutes(value) {
    const [hour, minute] = value.split(':').map(Number)
    return hour * 60 + minute
}

function fortalezaDateTimeParts(value) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date(value))
    return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value: partValue }) => [type, partValue]))
}

function isWithinConfiguredPeriods(appointment, periods) {
    const start = fortalezaDateTimeParts(appointment.starts_at)
    const end = fortalezaDateTimeParts(appointment.ends_at)
    if (`${start.year}-${start.month}-${start.day}` !== `${end.year}-${end.month}-${end.day}`) return false

    const dayOfWeek = WEEKDAY_NAMES.indexOf(start.weekday)
    const startMinutes = Number(start.hour) * 60 + Number(start.minute)
    const endMinutes = Number(end.hour) * 60 + Number(end.minute)
    return periods.some((period) => (
        period.day_of_week === dayOfWeek &&
        startMinutes >= timeToMinutes(period.opens_at) &&
        endMinutes <= timeToMinutes(period.closes_at)
    ))
}

async function getFutureConfirmedAppointments(supabase, profileId) {
    const pageSize = 500
    const appointments = []
    const now = new Date().toISOString()
    let offset = 0

    while (true) {
        const { data, error } = await supabase
            .from(APPOINTMENTS_TABLE)
            .select('id, customer_name, starts_at, ends_at')
            .eq('profile_id', profileId)
            .eq('status', 'confirmed')
            .gte('ends_at', now)
            .order('starts_at')
            .range(offset, offset + pageSize - 1)

        if (error) throw new Error('WORKING_HOURS_CONFLICT_CHECK_FAILED', { cause: error })
        appointments.push(...(data ?? []))
        if ((data ?? []).length < pageSize) break
        offset += pageSize
    }

    return appointments
}

export async function getWorkingHours(token, userId) {
    const profileId = await getBarbershopIdForUser(token, userId)
    const { data, error } = await createUserClient(token)
        .from(HOURS_TABLE)
        .select('id, day_of_week, period_index, opens_at, closes_at')
        .eq('profile_id', profileId)
        .order('day_of_week')
        .order('period_index')

    if (error) throw new Error('WORKING_HOURS_READ_FAILED', { cause: error })
    return data
}

export async function saveWorkingHours(token, userId, rows, { confirmConflicts = false } = {}) {
    const profileId = await getBarbershopIdForUser(token, userId)
    const supabase = createUserClient(token)
    const appointments = await getFutureConfirmedAppointments(supabase, profileId)
    const conflicts = appointments.filter((appointment) => !isWithinConfiguredPeriods(appointment, rows))

    if (conflicts.length > 0 && !confirmConflicts) {
        const error = new Error('WORKING_HOURS_CONFLICTS')
        error.conflicts = conflicts.slice(0, 25)
        error.totalConflicts = conflicts.length
        throw error
    }

    // A função do banco substitui toda a semana em uma única transação.
    const { data, error } = await supabase.rpc('replace_barbershop_working_hours', {
        p_profile_id: profileId,
        p_working_hours: rows
    })
    if (error) throw new Error('WORKING_HOURS_SAVE_FAILED', { cause: error })
    return data ?? []
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
    const periodsForDay = hours.filter((item) => item.day_of_week === dateDayOfWeek(date))
    if (!service || periodsForDay.length === 0) return { barbershop, services, slots: [] }

    const { data: busyTimes, error: busyError } = await supabase.rpc('get_public_busy_times', {
        p_slug: slug,
        p_date: date
    })
    if (busyError) throw new Error('PUBLIC_AVAILABILITY_FAILED', { cause: busyError })

    const slots = new Set()
    const durationMs = service.duration * 60_000
    for (const period of periodsForDay) {
        const opening = localDateTimeToIso(date, period.opens_at.slice(0, 5))
        const closing = localDateTimeToIso(date, period.closes_at.slice(0, 5))
        for (let start = new Date(opening).getTime(); start + durationMs <= new Date(closing).getTime(); start += durationMs) {
            const end = start + durationMs
            if (start <= Date.now()) continue
            if ((busyTimes ?? []).some((busy) => start < new Date(busy.ends_at).getTime() && end > new Date(busy.starts_at).getTime())) continue
            slots.add(new Date(start).toISOString())
        }
    }
    return { barbershop, services, slots: [...slots].sort() }
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
    const { data: periods, error: hoursError } = await supabase
        .from(HOURS_TABLE)
        .select('opens_at, closes_at')
        .eq('profile_id', barbershop.id)
        .eq('day_of_week', WEEKDAY_NAMES.indexOf(weekday))
        .order('period_index')
    if (hoursError) throw new Error('WORKING_HOURS_READ_FAILED', { cause: hoursError })
    if (!periods?.length) throw new Error('SLOT_UNAVAILABLE')

    const startParts = fortalezaDateTimeParts(startsAt)
    const endParts = fortalezaDateTimeParts(endsAt)
    const sameLocalDate = startParts.year === endParts.year && startParts.month === endParts.month && startParts.day === endParts.day
    const startsAtMinutes = Number(startParts.hour) * 60 + Number(startParts.minute)
    const endsAtMinutes = Number(endParts.hour) * 60 + Number(endParts.minute)
    const withinBusinessHours = sameLocalDate && periods.some((period) => (
        startsAtMinutes >= timeToMinutes(period.opens_at) &&
        endsAtMinutes <= timeToMinutes(period.closes_at)
    ))
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

export async function createPrivateAppointment(supabase, userId, payload) {
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)
    const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, duration')
        .eq('id', payload.serviceId)
        .eq('profile_id', profileId)
        .maybeSingle()

    if (serviceError) throw new Error('SERVICE_LOOKUP_FAILED', { cause: serviceError })
    if (!service) throw new Error('SERVICE_NOT_FOUND')

    const startsAt = new Date(payload.startsAt)
    const endsAt = new Date(startsAt.getTime() + service.duration * 60_000)
    const appointment = {
        profile_id: profileId,
        service_id: service.id,
        customer_name: payload.customerName,
        customer_phone: payload.customerPhone,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'confirmed'
    }

    const { data, error } = await supabase
        .from(APPOINTMENTS_TABLE)
        .insert(appointment)
        .select('id, profile_id, service_id, customer_name, customer_phone, starts_at, ends_at, status, created_at')
        .single()

    if (error?.code === '23P01') throw new Error('SLOT_TAKEN', { cause: error })
    if (error) throw new Error('APPOINTMENT_CREATE_FAILED', { cause: error })
    return data
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
