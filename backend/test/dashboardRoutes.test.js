import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const FROM = '2026-11-25T00:00:00-03:00'
const TO = '2026-11-26T00:00:00-03:00'

let appointmentsResult
let financeResult


mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: {
            auth: {
                async getUser(token) {
                    if (token === 'valid-token') return { data: { user: { id: 'user-1' } }, error: null }
                    return { data: { user: null }, error: new Error('invalid token') }
                }
            }
        },
        createUserClient: () => ({
            from(table) {
                if (table !== 'barbershops') throw new Error(`unexpected table: ${table}`)
                return {
                    select() { return this },
                    eq() { return this },
                    maybeSingle() {
                        return Promise.resolve({
                            data: { id: 'shop-1', name: 'Barbearia', slug: 'barbearia' },
                            error: null
                        })
                    }
                }
            }
        }),
        createPublicClient: () => ({})
    }
})

const unavailable = () => Promise.reject(new Error('not used in this test'))

mock.module('../src/services/schedulingService.js', {
    namedExports: {
        createPrivateAppointment: unavailable,
        createPublicAppointment: unavailable,
        getPublicBookingData: unavailable,
        getWorkingHours: unavailable,
        listAppointments: () => appointmentsResult(),
        saveWorkingHours: unavailable
    }
})

mock.module('../src/services/financeService.js', {
    namedExports: {
        createCategory: unavailable,
        createExpense: unavailable,
        createPayment: unavailable,
        createRefund: unavailable,
        deleteCategory: unavailable,
        getFinanceOverview: unavailable,
        getFinanceSummary: () => financeResult(),
        listCategories: unavailable,
        listExpenses: unavailable,
        listPayments: unavailable,
        updateCategory: unavailable,
        updateExpense: unavailable
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
    appointmentsResult = () => Promise.resolve([{ id: 'appointment-1' }])
    financeResult = () => Promise.resolve({ revenue: 10 })
}

async function request(token = 'valid-token') {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    return fetch(`${baseUrl}/dashboard/overview?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`, { headers })
}

test('requires authentication on the dashboard overview', async () => {
    reset()
    const response = await request(null)
    assert.equal(response.status, 401)
})

test('returns profile, appointments and finance summary in one response', async () => {
    reset()
    const response = await request()
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
        profile: { id: 'shop-1', name: 'Barbearia', slug: 'barbearia' },
        appointments: [{ id: 'appointment-1' }],
        financeSummary: { revenue: 10 }
    })
})

test('keeps the dashboard usable when the finance summary fails', async () => {
    reset()
    financeResult = () => Promise.reject(new Error('FINANCE_SUMMARY_FAILED'))
    const response = await request()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).financeSummary, null)
})

test('fails the dashboard when appointments cannot be loaded', async () => {
    reset()
    appointmentsResult = () => Promise.reject(new Error('APPOINTMENTS_READ_FAILED'))
    const response = await request()
    assert.equal(response.status, 500)
})
