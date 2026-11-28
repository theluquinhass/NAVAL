import { after, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const publicCalls = []
const availabilityCalls = []
let getUserCalls = 0

mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: {
            auth: {
                async getUser() {
                    getUserCalls += 1
                    return { data: { user: { id: 'user-1' } }, error: null }
                }
            }
        },
        createUserClient: (token) => ({ accessToken: token }),
        createPublicClient: () => ({})
    }
})

mock.module('../src/services/schedulingService.js', {
    namedExports: {
        createPrivateAppointment: async () => ({}),
        createPublicAppointment: async (slug, payload) => {
            publicCalls.push({ slug, payload })
            return { id: 'appointment-1' }
        },
        getPublicBookingData: async (slug, date, serviceId) => {
            availabilityCalls.push({ slug, date, serviceId })
            return { services: [{ id: 'service-1' }], slots: [] }
        },
        getWorkingHours: async () => [],
        listAppointments: async () => [],
        saveWorkingHours: async () => []
    }
})

function response() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(payload) {
            this.body = payload
            return this
        }
    }
}

after(() => mock.restoreAll())

test('public availability rejects impossible calendar dates and invalid service ids', async () => {
    const { getPublicAvailabilityController } = await import('../src/controllers/schedulingController.js')

    for (const query of [
        { date: '2026-99-99' },
        { date: '2026-02-30' },
        { date: '2026-11-25', serviceId: 'not-a-uuid' }
    ]) {
        const res = response()
        await getPublicAvailabilityController(
            { params: { slug: 'naval' }, query },
            res
        )
        assert.equal(res.statusCode, 400)
        assert.equal(res.body.code, 'VALIDATION_ERROR')
    }
})

test('public availability treats a missing or empty serviceId as absent and still returns the catalog', async () => {
    const { getPublicAvailabilityController } = await import('../src/controllers/schedulingController.js')

    for (const query of [
        { date: '2026-11-25' },
        { date: '2026-11-25', serviceId: '' }
    ]) {
        availabilityCalls.length = 0
        const res = response()
        await getPublicAvailabilityController({ params: { slug: 'naval' }, query }, res)

        assert.equal(res.statusCode, 200)
        assert.deepEqual(res.body.services, [{ id: 'service-1' }])
        assert.deepEqual(availabilityCalls, [{ slug: 'naval', date: '2026-11-25', serviceId: undefined }])
    }
})

test('public booking validates customer data before recording an appointment', async () => {
    const { postPublicAppointmentController } = await import('../src/controllers/schedulingController.js')

    const invalid = {
        customerName: 'Ana',
        customerPhone: 'x',
        serviceId: '8d8c9f3a-59f0-4d8c-9f0a-112233445566',
        startsAt: '2026-11-26T13:30:00.000Z'
    }
    const badRequest = response()
    await postPublicAppointmentController({ params: { slug: 'naval' }, body: invalid }, badRequest)
    assert.equal(badRequest.statusCode, 400)
    assert.equal(publicCalls.length, 0)

    publicCalls.length = 0
    const valid = response()
    await postPublicAppointmentController({
        params: { slug: 'naval' },
        body: { ...invalid, customerPhone: '+55 (85) 99999-1234' }
    }, valid)
    assert.equal(valid.statusCode, 201)
    assert.equal(publicCalls.length, 1)
    assert.equal(publicCalls[0].slug, 'naval')
    assert.equal(publicCalls[0].payload.customerPhone, '+55 (85) 99999-1234')
})

test('a plain authResolved property cannot bypass authentication', async () => {
    const { default: authMiddleware } = await import('../src/middlewares/authMiddleware.js')

    const req = {
        headers: { authorization: 'Bearer valid-token' },
        authResolved: true
    }
    const headers = {}
    const res = {
        status(code) { this.statusCode = code; return this },
        json(payload) { this.body = payload; return this },
        setHeader(name, value) { headers[name] = value },
        getHeader(name) { return headers[name] }
    }
    let called = false

    await authMiddleware(req, res, () => { called = true })

    assert.equal(called, true)
    assert.equal(getUserCalls, 1)
    assert.equal(req.user.id, 'user-1')
})
