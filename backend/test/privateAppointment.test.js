import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { clearProfileCache } from '../src/services/barbershopService.js'

const calls = []
let barbershopResult
let serviceResult
let insertResult
let insertedAppointment

const barbershop = { id: 'shop-1' }
const service = { id: 'service-1', profile_id: 'shop-1', duration: 45 }
const createdAppointment = {
    id: 'appointment-1',
    profile_id: 'shop-1',
    service_id: 'service-1',
    customer_name: 'Ana Souza',
    customer_phone: '+55 (85) 99999-1234',
    starts_at: '2026-11-26T13:30:00.000Z',
    ends_at: '2026-11-26T14:15:00.000Z',
    status: 'confirmed',
    created_at: '2026-11-25T12:00:00.000Z'
}

const payload = {
    customerName: 'Ana Souza',
    customerPhone: '+55 (85) 99999-1234',
    serviceId: service.id,
    startsAt: '2026-11-26T10:30:00-03:00'
}

const supabase = {
    from(table) {
        const call = { table, filters: [] }
        calls.push(call)
        const query = {
            select(columns) {
                call.select = columns
                return this
            },
            eq(column, value) {
                call.filters.push([column, value])
                return this
            },
            maybeSingle() {
                let result = table === 'barbershops' ? barbershopResult : serviceResult
                const requestedProfileId = call.filters.find(([column]) => column === 'profile_id')?.[1]
                if (table === 'services' && result.data?.profile_id && result.data.profile_id !== requestedProfileId) {
                    result = { data: null, error: null }
                }
                return Promise.resolve(result)
            },
            insert(record) {
                insertedAppointment = structuredClone(record)
                call.insert = insertedAppointment
                return this
            },
            single() {
                return Promise.resolve(insertResult)
            }
        }
        return query
    }
}

mock.module('../src/config/supabase.js', {
    namedExports: {
        createPublicClient: () => { throw new Error('Public client must not be used') },
        createUserClient: () => { throw new Error('Service must use the supplied authenticated client') },
        supabase
    }
})

let createPrivateAppointment
before(async () => {
    ;({ createPrivateAppointment } = await import('../src/services/schedulingService.js'))
})

after(() => mock.restoreAll())

function reset() {
    calls.length = 0
    clearProfileCache()
    barbershopResult = { data: barbershop, error: null }
    serviceResult = { data: service, error: null }
    insertResult = { data: createdAppointment, error: null }
    insertedAppointment = null
}

test('creates a private appointment with the authenticated Supabase client', async () => {
    reset()
    const result = await createPrivateAppointment(supabase, 'user-1', payload)

    assert.deepEqual(result, createdAppointment)
    assert.equal(calls[0].table, 'barbershops')
    assert.equal(calls[0].filters[0][0], 'user_id')
    assert.equal(calls[0].filters[0][1], 'user-1')
    assert.equal(calls[1].table, 'services')
    assert.deepEqual(calls[1].filters, [['id', payload.serviceId], ['profile_id', barbershop.id]])
    assert.equal(calls[2].table, 'appointments')
})

test('rejects a user without a registered barbershop', async () => {
    reset()
    barbershopResult = { data: null, error: null }
    await assert.rejects(createPrivateAppointment(supabase, 'user-1', payload), { message: 'BARBERSHOP_NOT_FOUND' })
    assert.equal(calls.length, 1)
})

test('rejects a service that does not belong to the authenticated barbershop', async () => {
    reset()
    serviceResult = { data: { ...service, profile_id: 'another-shop-id' }, error: null }
    await assert.rejects(createPrivateAppointment(supabase, 'user-1', payload), { message: 'SERVICE_NOT_FOUND' })
    assert.deepEqual(calls[1].filters, [['id', payload.serviceId], ['profile_id', barbershop.id]])
    assert.equal(calls.some((call) => call.table === 'appointments'), false)
})

test('preserves the cause when the barbershop lookup fails', async () => {
    reset()
    const queryError = { code: '42501', message: 'barbershop lookup denied' }
    barbershopResult = { data: null, error: queryError }
    await assert.rejects(createPrivateAppointment(supabase, 'user-1', payload), (error) => {
        assert.equal(error.message, 'BARBERSHOP_LOOKUP_FAILED')
        assert.equal(error.cause, queryError)
        return true
    })
})

test('preserves the cause when the service lookup fails', async () => {
    reset()
    const queryError = { code: '42501', message: 'service lookup denied' }
    serviceResult = { data: null, error: queryError }
    await assert.rejects(createPrivateAppointment(supabase, 'user-1', payload), (error) => {
        assert.equal(error.message, 'SERVICE_LOOKUP_FAILED')
        assert.equal(error.cause, queryError)
        return true
    })
})

test('preserves the cause when appointment insertion fails', async () => {
    reset()
    const insertError = { code: '42501', message: 'appointment insert denied' }
    insertResult = { data: null, error: insertError }
    await assert.rejects(createPrivateAppointment(supabase, 'user-1', payload), (error) => {
        assert.equal(error.message, 'APPOINTMENT_CREATE_FAILED')
        assert.equal(error.cause, insertError)
        return true
    })
})

test('maps SQLSTATE 23P01 to an appointment conflict without retrying', async () => {
    reset()
    const conflict = { code: '23P01', message: 'conflicting key value violates exclusion constraint' }
    insertResult = { data: null, error: conflict }
    await assert.rejects(createPrivateAppointment(supabase, 'user-1', payload), (error) => {
        assert.equal(error.message, 'SLOT_TAKEN')
        assert.equal(error.cause, conflict)
        return true
    })
    assert.equal(calls.filter((call) => call.table === 'appointments').length, 1)
})

test('calculates ends_at from the service duration stored in the database', async () => {
    reset()
    serviceResult = { data: { ...service, duration: 60 }, error: null }
    await createPrivateAppointment(supabase, 'user-1', payload)

    assert.equal(insertedAppointment.ends_at, '2026-11-26T14:30:00.000Z')
    assert.notEqual(insertedAppointment.ends_at, createdAppointment.ends_at)
})

test('inserts the server-resolved profile, trusted service data, and confirmed status', async () => {
    reset()
    barbershopResult = { data: { id: 'resolved-shop-id' }, error: null }
    serviceResult = { data: { id: 'resolved-service-id', duration: 30 }, error: null }
    await createPrivateAppointment(supabase, 'user-1', payload)

    assert.equal(insertedAppointment.profile_id, 'resolved-shop-id')
    assert.equal(insertedAppointment.service_id, 'resolved-service-id')
    assert.equal(insertedAppointment.customer_name, payload.customerName)
    assert.equal(insertedAppointment.customer_phone, payload.customerPhone)
    assert.equal(insertedAppointment.starts_at, '2026-11-26T13:30:00.000Z')
    assert.equal(insertedAppointment.ends_at, '2026-11-26T14:00:00.000Z')
    assert.equal(insertedAppointment.status, 'confirmed')
    assert.deepEqual(Object.keys(insertedAppointment).sort(), [
        'customer_name', 'customer_phone', 'ends_at', 'profile_id', 'service_id', 'starts_at', 'status'
    ])
})
