import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { clearProfileCache } from '../src/services/barbershopService.js'

const ID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const FROM = '2026-11-01T00:00:00-03:00'
const TO = '2026-12-01T00:00:00-03:00'

const calls = []
const results = new Map()

function resultFor(call) {
    return results.get(`${call.table}:${call.mutation ?? 'select'}`) ?? { data: [], error: null }
}

const supabase = {
    from(table) {
        const call = { table, filters: [] }
        calls.push(call)
        const query = {
            select(columns) {
                call.selected = columns
                return this
            },
            insert(record) {
                call.mutation = 'insert'
                call.record = record
                return this
            },
            update(record) {
                call.mutation = 'update'
                call.record = record
                return this
            },
            delete() {
                call.mutation = 'delete'
                return this
            },
            eq(column, value) {
                call.filters.push([column, value])
                return this
            },
            gte(column, value) {
                call.filters.push([`${column} >=`, value])
                return this
            },
            lt(column, value) {
                call.filters.push([`${column} <`, value])
                return this
            },
            order(column) {
                call.order = column
                return this
            },
            limit(count) {
                call.limit = count
                return this
            },
            single() {
                return Promise.resolve(resultFor(call))
            },
            maybeSingle() {
                return Promise.resolve(resultFor(call))
            },
            then(resolve, reject) {
                return Promise.resolve(resultFor(call)).then(resolve, reject)
            }
        }
        return query
    }
}

mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: {},
        createPublicClient: () => { throw new Error('Finance must not use the public client') },
        createUserClient: (token) => {
            assert.equal(token, 'token-1')
            return supabase
        }
    }
})

let financeService
before(async () => {
    financeService = await import('../src/services/financeService.js')
})

after(() => mock.restoreAll())

function reset() {
    calls.length = 0
    results.clear()
    results.set('barbershops:select', { data: { id: 'shop-1' }, error: null })
    clearProfileCache()
}

test('sums all ledger tables in cents and reports the Fortaleza time zone', async () => {
    reset()
    results.set('payments:select', {
        data: [
            { id: 'p1', amount: '30.00', paid_at: FROM },
            { id: 'p2', amount: '12.50', paid_at: FROM }
        ],
        error: null
    })
    results.set('payment_refunds:select', { data: [{ id: 'r1', amount: '5.00', refunded_at: FROM }], error: null })
    results.set('expenses:select', { data: [{ id: 'e1', amount: '18.90', spent_at: FROM }], error: null })

    const summary = await financeService.getFinanceSummary('token-1', 'user-1', FROM, TO)

    assert.deepEqual(summary, {
        period: { from: FROM, to: TO, timeZone: 'America/Fortaleza' },
        currency: 'BRL',
        revenue: 42.5,
        refunds: 5,
        netRevenue: 37.5,
        expenses: 18.9,
        balance: 18.6,
        paymentsCount: 2,
        refundsCount: 1,
        expensesCount: 1
    })

    assert.equal(calls[0].table, 'barbershops')
    assert.deepEqual(calls[0].filters, [['user_id', 'user-1']])
    for (const [table, column] of [
        ['payments', 'paid_at'],
        ['payment_refunds', 'refunded_at'],
        ['expenses', 'spent_at']
    ]) {
        const call = calls.find((entry) => entry.table === table)
        assert.ok(call, `missing query on ${table}`)
        assert.deepEqual(call.filters, [
            ['profile_id', 'shop-1'],
            [`${column} >=`, FROM],
            [`${column} <`, TO]
        ])
    }
})

test('returns zeroed amounts when there are no records in the period', async () => {
    reset()
    const summary = await financeService.getFinanceSummary('token-1', 'user-1', FROM, TO)

    assert.equal(summary.revenue, 0)
    assert.equal(summary.refunds, 0)
    assert.equal(summary.netRevenue, 0)
    assert.equal(summary.expenses, 0)
    assert.equal(summary.balance, 0)
})

test('resolves the profile from the authenticated user before recording a payment', async () => {
    reset()
    const created = { id: 'pay-1', amount: '12.35' }
    results.set('payments:insert', { data: created, error: null })

    const payment = await financeService.createPayment('token-1', 'user-1', {
        appointmentId: ID,
        amount: '12.35',
        paidAt: '2026-11-25T10:00:00-03:00',
        method: 'Pix',
        note: 'Entrada combinada'
    })

    assert.deepEqual(payment, created)
    assert.equal(calls[0].table, 'barbershops')
    assert.equal(calls[1].table, 'payments')
    assert.deepEqual(Object.keys(calls[1].record).sort(), [
        'amount', 'appointment_id', 'method', 'note', 'paid_at', 'profile_id'
    ])
    assert.equal(calls[1].record.profile_id, 'shop-1')
    assert.equal(calls[1].record.amount, '12.35')
    assert.equal(calls[1].record.appointment_id, ID)
})

test('maps payment database errors to actionable codes', async () => {
    reset()
    results.set('payments:insert', { data: null, error: { code: '23503', message: 'fk' } })
    await assert.rejects(
        financeService.createPayment('token-1', 'user-1', { amount: '10.00', paidAt: FROM, method: 'Pix' }),
        { message: 'APPOINTMENT_NOT_FOUND' }
    )

    reset()
    const invalidLink = { code: '22023', message: 'wrong tenant' }
    results.set('payments:insert', { data: null, error: invalidLink })
    await assert.rejects(
        financeService.createPayment('token-1', 'user-1', { amount: '10.00', paidAt: FROM, method: 'Pix' }),
        (error) => error.message === 'INVALID_FINANCE_LINK' && error.cause === invalidLink
    )

    reset()
    const denied = { code: '42501', message: 'RLS' }
    results.set('payments:insert', { data: null, error: denied })
    await assert.rejects(
        financeService.createPayment('token-1', 'user-1', { amount: '10.00', paidAt: FROM, method: 'Pix' }),
        (error) => error.message === 'PAYMENT_CREATE_FAILED' && error.cause === denied
    )
})

test('maps refund validation failures without deleting the original payment', async () => {
    reset()
    results.set('payment_refunds:insert', { data: null, error: { code: '22023', message: 'exceeds payment' } })
    await assert.rejects(
        financeService.createRefund('token-1', 'user-1', { paymentId: ID, amount: '5.00', refundedAt: TO }),
        { message: 'REFUND_INVALID' }
    )
    assert.equal(calls.some((call) => call.table === 'payments' && call.mutation === 'delete'), false)

    reset()
    results.set('payment_refunds:insert', { data: { id: 'refund-1' }, error: null })
    await financeService.createRefund('token-1', 'user-1', { paymentId: ID, amount: '5.00', refundedAt: TO })
    const call = calls.find((entry) => entry.table === 'payment_refunds')
    assert.equal(call.mutation, 'insert')
    assert.equal(call.record.profile_id, 'shop-1')
    assert.equal(call.record.payment_id, ID)
})

test('scopes expense updates and category deletion to the resolved profile', async () => {
    reset()
    results.set('expenses:update', { data: null, error: null })
    await assert.rejects(
        financeService.updateExpense('token-1', 'user-1', ID, {
            categoryId: null,
            description: 'Cafeina',
            amount: '18.90',
            spentAt: FROM,
            paymentMethod: null,
            note: null
        }),
        { message: 'EXPENSE_NOT_FOUND' }
    )
    const updateCall = calls.find((call) => call.table === 'expenses')
    assert.equal(updateCall.mutation, 'update')
    assert.deepEqual(updateCall.filters, [['id', ID], ['profile_id', 'shop-1']])

    reset()
    results.set('expense_categories:delete', { data: { id: ID }, error: null })
    await financeService.deleteCategory('token-1', 'user-1', ID)
    const deleteCall = calls.find((call) => call.table === 'expense_categories')
    assert.equal(deleteCall.mutation, 'delete')
    assert.deepEqual(deleteCall.filters, [['id', ID], ['profile_id', 'shop-1']])
})

test('fails closed when the authenticated user has no barbershop', async () => {
    reset()
    results.set('barbershops:select', { data: null, error: null })

    await assert.rejects(
        financeService.getFinanceSummary('token-1', 'user-1', FROM, TO),
        { message: 'BARBERSHOP_NOT_FOUND' }
    )
    assert.equal(calls.length, 1)
})
