import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const calls = []
let busyTimes = []
let busyError = null
let hasService = true
let hasHours = true

const barbershop = { id: 'shop-1', name: 'NAVAL' }
const service = { id: 'service-1', name: 'Corte', description: null, price: 25, duration: 30 }
const date = '2099-06-15'
const dayOfWeek = new Date(`${date}T12:00:00-03:00`).getUTCDay()

function queryResult(table) {
    const query = {
        select() { return this },
        eq() { return this },
        order() { return this },
        then(resolve, reject) {
            const data = table === 'services'
                ? (hasService ? [service] : [])
                : (hasHours ? [{ day_of_week: dayOfWeek, opens_at: '09:00:00', closes_at: '11:00:00' }] : [])
            return Promise.resolve({ data, error: null }).then(resolve, reject)
        }
    }
    return query
}

const fakeClient = {
    from(table) { return queryResult(table) },
    async rpc(name, args) {
        calls.push({ name, args })
        if (name === 'get_public_barbershop') return { data: [barbershop], error: null }
        if (name === 'get_public_busy_times') return { data: busyTimes, error: busyError }
        throw new Error(`Unexpected RPC: ${name}`)
    }
}

mock.module('../src/config/supabase.js', {
    namedExports: {
        createPublicClient: () => fakeClient,
        createUserClient: () => fakeClient,
        supabase: fakeClient
    }
})

let getPublicBookingData
before(async () => {
    ;({ getPublicBookingData } = await import('../src/services/schedulingService.js'))
})

after(() => mock.restoreAll())

function reset() {
    calls.length = 0
    busyTimes = []
    busyError = null
    hasService = true
    hasHours = true
}

test('returns available slots when there are no appointments', async () => {
    reset()
    const result = await getPublicBookingData('naval', date, service.id)
    assert.deepEqual(result.slots, [
        '2099-06-15T12:00:00.000Z',
        '2099-06-15T12:30:00.000Z',
        '2099-06-15T13:00:00.000Z',
        '2099-06-15T13:30:00.000Z'
    ])
})

test('removes slots that overlap confirmed busy times', async () => {
    reset()
    busyTimes = [{ starts_at: '2099-06-15T12:30:00.000Z', ends_at: '2099-06-15T13:00:00.000Z' }]
    const result = await getPublicBookingData('naval', date, service.id)
    assert.deepEqual(result.slots, ['2099-06-15T12:00:00.000Z', '2099-06-15T13:00:00.000Z', '2099-06-15T13:30:00.000Z'])
})

test('does not return slots before the current time', async () => {
    reset()
    const now = Date.parse('2099-06-15T12:45:00.000Z')
    const nowMock = mock.method(Date, 'now', () => now)
    try {
        const result = await getPublicBookingData('naval', date, service.id)
        assert.deepEqual(result.slots, ['2099-06-15T13:00:00.000Z', '2099-06-15T13:30:00.000Z'])
    } finally {
        nowMock.mock.restore()
    }
})

test('returns no slots when the shop has no working hours for the day', async () => {
    reset()
    hasHours = false
    const result = await getPublicBookingData('naval', date, service.id)
    assert.deepEqual(result.slots, [])
    assert.equal(calls.some(({ name }) => name === 'get_public_busy_times'), false)
})

test('returns no slots when the requested service does not exist', async () => {
    reset()
    hasService = false
    const result = await getPublicBookingData('naval', date, service.id)
    assert.deepEqual(result.slots, [])
    assert.equal(calls.some(({ name }) => name === 'get_public_busy_times'), false)
})

test('propagates availability query errors with the established error code', async () => {
    reset()
    busyError = { message: 'RPC failed' }
    await assert.rejects(getPublicBookingData('naval', date, service.id), (error) => {
        assert.equal(error.message, 'PUBLIC_AVAILABILITY_FAILED')
        assert.equal(error.cause, busyError)
        return true
    })
})

test('calls the public availability RPC with exactly the slug and date', async () => {
    reset()
    await getPublicBookingData('naval', date, service.id)
    const availabilityCall = calls.find(({ name }) => name === 'get_public_busy_times')
    assert.deepEqual(availabilityCall, { name: 'get_public_busy_times', args: { p_slug: 'naval', p_date: date } })
})

test('does not send the legacy profile and date range parameters', async () => {
    reset()
    await getPublicBookingData('naval', date, service.id)
    const availabilityCall = calls.find(({ name }) => name === 'get_public_busy_times')
    assert.ok(availabilityCall)
    for (const oldParameter of ['p_profile_id', 'p_from', 'p_to']) {
        assert.equal(Object.hasOwn(availabilityCall.args, oldParameter), false)
    }
})
