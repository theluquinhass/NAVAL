import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

let createAppointmentImplementation
const serviceCalls = []
const createdAppointment = {
    id: 'appointment-1',
    profile_id: 'shop-1',
    service_id: '8d8c9f3a-59f0-4d8c-9f0a-112233445566',
    customer_name: 'Ana Souza',
    customer_phone: '+55 (85) 99999-1234',
    starts_at: '2099-11-26T13:30:00.000Z',
    ends_at: '2099-11-26T14:00:00.000Z',
    status: 'confirmed'
}

const authenticatedSupabase = { accessToken: 'valid-token' }
const supabaseAuth = {
    async getUser(token) {
        if (token === 'valid-token') return { data: { user: { id: 'user-1' } }, error: null }
        return { data: { user: null }, error: new Error('invalid token') }
    }
}

mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: { auth: supabaseAuth },
        createUserClient: (token) => ({ ...authenticatedSupabase, accessToken: token }),
        createPublicClient: () => ({})
    }
})

mock.module('../src/services/schedulingService.js', {
    namedExports: {
        createPrivateAppointment: (...args) => {
            serviceCalls.push(args)
            return createAppointmentImplementation(...args)
        },
        createPublicAppointment: async () => ({}),
        getPublicBookingData: async () => ({}),
        getWorkingHours: async () => [],
        listAppointments: async () => [],
        saveWorkingHours: async () => []
    }
})

let server
let baseUrl
before(async () => {
    const { default: app } = await import('../src/app.js')
    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    mock.restoreAll()
})

function reset() {
    serviceCalls.length = 0
    createAppointmentImplementation = async () => createdAppointment
}

async function postAppointment({ token = 'valid-token', body } = {}) {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    return fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
}

const validPayload = {
    customerName: 'Ana Souza',
    customerPhone: '+55 (85) 99999-1234',
    serviceId: '8d8c9f3a-59f0-4d8c-9f0a-112233445566',
    startsAt: '2099-11-26T10:30:00-03:00'
}

test('rejects an invalid payload with HTTP 400 without calling the service', async () => {
    reset()
    const response = await postAppointment({ body: { ...validPayload, startsAt: 'not-a-date' } })

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /startsAt/)
    assert.equal(serviceCalls.length, 0)
})

test('creates an appointment and returns HTTP 201', async () => {
    reset()
    const response = await postAppointment({ body: validPayload })

    assert.equal(response.status, 201)
    assert.deepEqual((await response.json()).appointment, createdAppointment)
    assert.equal(serviceCalls.length, 1)
    assert.equal(serviceCalls[0][0].accessToken, 'valid-token')
    assert.equal(serviceCalls[0][1], 'user-1')
    assert.deepEqual(serviceCalls[0][2], validPayload)
})

test('returns HTTP 404 when the user has no barbershop', async () => {
    reset()
    createAppointmentImplementation = async () => { throw new Error('BARBERSHOP_NOT_FOUND') }
    const response = await postAppointment({ body: validPayload })

    assert.equal(response.status, 404)
    assert.match((await response.json()).error, /Barbearia/)
})

test('returns HTTP 404 when the service is missing or belongs to another barbershop', async () => {
    reset()
    createAppointmentImplementation = async () => { throw new Error('SERVICE_NOT_FOUND') }
    const response = await postAppointment({ body: validPayload })

    assert.equal(response.status, 404)
    assert.match((await response.json()).error, /serviço/)
})

test('returns HTTP 409 when the database reports an overlapping appointment', async () => {
    reset()
    createAppointmentImplementation = async () => { throw new Error('SLOT_TAKEN') }
    const response = await postAppointment({ body: validPayload })

    assert.equal(response.status, 409)
    assert.match((await response.json()).error, /horário/)
})

test('returns a generic HTTP 500 and logs the original database error', async () => {
    reset()
    const databaseError = { code: '42501', message: 'RLS rejected the insert' }
    createAppointmentImplementation = async () => {
        throw new Error('APPOINTMENT_CREATE_FAILED', { cause: databaseError })
    }
    const log = mock.method(console, 'error', () => {})
    try {
        const response = await postAppointment({ body: validPayload })
        assert.equal(response.status, 500)
        assert.deepEqual(await response.json(), {
            error: 'Não foi possível concluir a operação.',
            code: 'SCHEDULING_ACTION_FAILED'
        })
    } finally {
        log.mock.restore()
    }

    assert.equal(log.mock.callCount(), 1)
    assert.match(log.mock.calls[0].arguments[0], /APPOINTMENT_CREATE_FAILED/)
    assert.equal(log.mock.calls[0].arguments[1], databaseError.code)
    assert.equal(log.mock.calls[0].arguments[2], databaseError.message)
})

test('requires authentication before reaching the private appointment controller', async () => {
    reset()
    const response = await postAppointment({ token: null, body: validPayload })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Acesso negado' })
    assert.equal(serviceCalls.length, 0)
})
