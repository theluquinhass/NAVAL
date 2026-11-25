import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const ID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const FROM = '2026-11-01T00:00:00-03:00'
const TO = '2026-12-01T00:00:00-03:00'
const calls = []

let implementation

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
        createUserClient: (token) => ({ accessToken: token }),
        createPublicClient: () => ({})
    }
})

mock.module('../src/services/financeService.js', {
    namedExports: {
        getFinanceSummary: (...args) => record('getFinanceSummary', args),
        listPayments: (...args) => record('listPayments', args),
        createPayment: (...args) => record('createPayment', args),
        createRefund: (...args) => record('createRefund', args),
        listExpenses: (...args) => record('listExpenses', args),
        createExpense: (...args) => record('createExpense', args),
        updateExpense: (...args) => record('updateExpense', args),
        listCategories: (...args) => record('listCategories', args),
        createCategory: (...args) => record('createCategory', args),
        updateCategory: (...args) => record('updateCategory', args),
        deleteCategory: (...args) => record('deleteCategory', args)
    }
})

function record(name, args) {
    calls.push({ name, args })
    if (!implementation) return {}
    return implementation[name](...args)
}

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
    calls.length = 0
    implementation = null
}

async function request(path, { method = 'GET', token = 'valid-token', body } = {}) {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    return fetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
}

test('requires authentication on every finance endpoint', async () => {
    reset()
    const response = await request('/finance/summary', { token: null })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Acesso negado' })
    assert.equal(calls.length, 0)
})

test('rejects an invalid period before calling the service', async () => {
    reset()
    const response = await request('/finance/summary?from=2026-11-01&to=2026-12-01')

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /ISO 8601/)
    assert.equal(calls.length, 0)
})

test('returns the summary using the authenticated token and resolved period', async () => {
    reset()
    const summary = { revenue: 30, refunds: 0, netRevenue: 30, expenses: 10, balance: 20 }
    implementation = { getFinanceSummary: () => summary }
    const response = await request(`/finance/summary?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`)

    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).summary, summary)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].name, 'getFinanceSummary')
    assert.deepEqual(calls[0].args, ['valid-token', 'user-1', FROM, TO])
})

test('rejects client-supplied profile_id in a payment payload', async () => {
    reset()
    const response = await request('/finance/payments', {
        method: 'POST',
        body: { amount: '30.00', paidAt: FROM, method: 'Pix', profileId: 'other-shop' }
    })

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /profileId/)
    assert.equal(calls.length, 0)
})

test('records a payment and maps a missing barbershop to HTTP 404', async () => {
    reset()
    const payment = { id: 'pay-1', amount: '12.35' }
    implementation = { createPayment: () => payment }
    const response = await request('/finance/payments', {
        method: 'POST',
        body: {
            appointmentId: ID,
            amount: '12.35',
            paidAt: '2026-11-25T10:00:00-03:00',
            method: 'Pix',
            note: 'Entrada combinada'
        }
    })

    assert.equal(response.status, 201)
    assert.deepEqual((await response.json()).payment, payment)
    assert.equal(calls[0].args[1], 'user-1')
    assert.equal(calls[0].args[2].amount, '12.35')

    reset()
    implementation = { createPayment: () => { throw new Error('BARBERSHOP_NOT_FOUND') } }
    const notFound = await request('/finance/payments', {
        method: 'POST',
        body: { amount: '12.35', paidAt: FROM, method: 'Pix' }
    })
    assert.equal(notFound.status, 404)
})

test('maps an invalid refund to HTTP 409 and validates ids on parameterized routes', async () => {
    reset()
    implementation = { createRefund: () => { throw new Error('REFUND_INVALID') } }
    const refund = await request('/finance/refunds', {
        method: 'POST',
        body: { paymentId: ID, amount: '5.00', refundedAt: TO }
    })

    assert.equal(refund.status, 409)
    assert.match((await refund.json()).error, /inválida/)

    const invalidId = await request('/finance/categories/not-a-uuid', { method: 'DELETE' })
    assert.equal(invalidId.status, 400)
    assert.equal(calls.length, 1)
})

test('deletes a category with HTTP 204 and maps a missing record to HTTP 404', async () => {
    reset()
    implementation = { deleteCategory: () => ({ id: ID }) }
    const deleted = await request(`/finance/categories/${ID}`, { method: 'DELETE' })
    assert.equal(deleted.status, 204)
    assert.deepEqual(calls[0].args, ['valid-token', 'user-1', ID])

    reset()
    implementation = { deleteCategory: () => { throw new Error('CATEGORY_NOT_FOUND') } }
    const missing = await request(`/finance/categories/${ID}`, { method: 'DELETE' })
    assert.equal(missing.status, 404)
})
