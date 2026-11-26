import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { clearProfileCache } from '../src/services/barbershopService.js'

const ID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const KEY = 'b1b2c3d4-59f0-4d8c-9f0a-112233445566'
const FROM = '2026-11-01T00:00:00-03:00'
const TO = '2026-12-01T00:00:00-03:00'

const calls = []
const results = new Map()

function resultFor(key, fallback) {
    const value = results.get(key)
    if (Array.isArray(value)) return value.length > 0 ? value.shift() : fallback
    return value ?? fallback
}

function resultForCall(call) {
    if (call.rpc) return resultFor(`rpc:${call.rpc}`, { data: [], error: null })
    if (call.filters.some(([column]) => column === 'idempotency_key')) {
        return resultFor(`${call.table}:idempotency`, { data: null, error: null })
    }
    return resultFor(`${call.table}:${call.mutation ?? 'select'}`, { data: [], error: null })
}

const supabase = {
    from(table) {
        const call = { table, filters: [] }
        calls.push(call)
        const query = {
            select(columns, options) {
                call.selected = columns
                call.selectOptions = options
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
            range(start, end) {
                call.range = [start, end]
                return this
            },
            single() {
                return Promise.resolve(resultForCall(call))
            },
            maybeSingle() {
                const { data, error } = resultForCall(call)
                return Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error })
            },
            then(resolve, reject) {
                return Promise.resolve(resultForCall(call)).then(resolve, reject)
            }
        }
        return query
    },
    rpc(name, args) {
        const call = { rpc: name, args }
        calls.push(call)
        return Promise.resolve(resultForCall(call))
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
    results.set('rpc:finance_period_totals', {
        data: {
            revenue_cents: '0',
            payments_count: '0',
            refunds_cents: '0',
            refunds_count: '0',
            expense_cents: '0',
            expenses_count: '0'
        },
        error: null
    })
    clearProfileCache()
}

test('uses the totals RPC with an exclusive end date and converts cents with integer math', async () => {
    reset()
    results.set('rpc:finance_period_totals', {
        data: {
            revenue_cents: '4250',
            payments_count: '2',
            refunds_cents: '500',
            refunds_count: '1',
            expense_cents: '1890',
            expenses_count: '1'
        },
        error: null
    })

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

    assert.deepEqual(calls.find((call) => call.rpc === 'finance_period_totals'), {
        rpc: 'finance_period_totals',
        args: { p_profile_id: 'shop-1', p_from: FROM, p_to: TO }
    })
    assert.equal(calls.some((call) => call.table === 'payments'), false)
})

test('returns zeroed amounts when there are no records in the period', async () => {
    reset()
    const summary = await financeService.getFinanceSummary('token-1', 'user-1', FROM, TO)

    assert.equal(summary.revenue, 0)
    assert.equal(summary.refunds, 0)
    assert.equal(summary.netRevenue, 0)
    assert.equal(summary.expenses, 0)
    assert.equal(summary.balance, 0)
    assert.equal(summary.paymentsCount, 0)
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
        'amount', 'appointment_id', 'idempotency_key', 'method', 'note', 'paid_at', 'profile_id'
    ])
    assert.equal(calls[1].record.idempotency_key, null)
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
    assert.equal(call.record.idempotency_key, null)
})

test('returns the original payment when the idempotency key was already used', async () => {
    reset()
    const original = { id: 'pay-existing', amount: '12.35' }
    results.set('payments:idempotency', { data: original, error: null })

    const payment = await financeService.createPayment('token-1', 'user-1', {
        amount: '12.35', paidAt: FROM, method: 'Pix', idempotencyKey: KEY
    })

    assert.deepEqual(payment, original)
    assert.equal(calls.some((call) => call.table === 'payments' && call.mutation === 'insert'), false)
    const lookup = calls.find((call) => call.table === 'payments')
    assert.deepEqual(lookup.filters, [['profile_id', 'shop-1'], ['idempotency_key', KEY]])
})

test('re-reads the original record after a uniqueness race on payments and refunds', async () => {
    reset()
    const originalPayment = { id: 'pay-existing', amount: '12.35' }
    results.set('payments:insert', { data: null, error: { code: '23505', message: 'duplicate' } })
    // The first lookup happens before the insert (no row yet); the second one
    // races with it and sees the row created by the other request.
    results.set('payments:idempotency', [
        { data: null, error: null },
        { data: originalPayment, error: null }
    ])

    const payment = await financeService.createPayment('token-1', 'user-1', {
        amount: '12.35', paidAt: FROM, method: 'Pix', idempotencyKey: KEY
    })
    assert.deepEqual(payment, originalPayment)
    assert.equal(calls.filter((call) => call.table === 'payments' && call.mutation !== 'insert').length, 2)

    reset()
    const originalRefund = { id: 'refund-existing', amount: '5.00' }
    results.set('payment_refunds:insert', { data: null, error: { code: '23505', message: 'duplicate' } })
    results.set('payment_refunds:idempotency', [
        { data: null, error: null },
        { data: originalRefund, error: null }
    ])

    const refund = await financeService.createRefund('token-1', 'user-1', {
        paymentId: ID, amount: '5.00', refundedAt: TO, idempotencyKey: KEY
    })
    assert.deepEqual(refund, originalRefund)
    assert.equal(calls.filter((call) => call.table === 'payment_refunds' && call.mutation !== 'insert').length, 2)
})

test('exposes stock-purchase expenses and never accepts source fields from clients', async () => {
    reset()
    results.set('expenses:select', {
        data: [{
            id: 'e1',
            amount: '100.00',
            spent_at: FROM,
            source_type: 'stock_entry',
            inventory_movement_id: ID
        }],
        error: null
    })

    const expenses = await financeService.listExpenses('token-1', 'user-1', FROM, TO)
    const readCall = calls.find((call) => call.table === 'expenses')
    assert.equal(expenses[0].source_type, 'stock_entry')
    assert.match(readCall.selected, /source_type/)
    assert.match(readCall.selected, /inventory_movement_id/)
    assert.deepEqual(readCall.selectOptions, { count: 'exact' })

    reset()
    results.set('expenses:insert', { data: { id: 'e2' }, error: null })
    await financeService.createExpense('token-1', 'user-1', {
        categoryId: null,
        description: 'Compra de estoque',
        amount: '100.00',
        spentAt: FROM,
        paymentMethod: null,
        note: null,
        sourceType: 'stock_entry',
        inventoryMovementId: ID
    })

    const insertCall = calls.find((call) => call.table === 'expenses')
    assert.equal(Object.hasOwn(insertCall.record, 'source_type'), false)
    assert.equal(Object.hasOwn(insertCall.record, 'inventory_movement_id'), false)
})

test('ranges list queries and reports the exact count on request', async () => {
    reset()
    const page = { limit: 25, offset: 50 }
    results.set('payments:select', { data: [{ id: 'p1' }], count: 120, error: null })

    const result = await financeService.listPayments('token-1', 'user-1', FROM, TO, page, { withCount: true })
    const call = calls.find((entry) => entry.table === 'payments')
    assert.deepEqual(result, { rows: [{ id: 'p1' }], count: 120 })
    assert.deepEqual(call.range, [50, 74])
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

test('maps a 22023 expense update failure to a stock-entry conflict', async () => {
    reset()
    const databaseError = { code: '22023', message: 'cannot change stock entry fields' }
    results.set('expenses:update', { data: null, error: databaseError })

    await assert.rejects(
        financeService.updateExpense('token-1', 'user-1', ID, {
            categoryId: null,
            description: 'Cafeina',
            amount: '18.90',
            spentAt: FROM,
            paymentMethod: null,
            note: null
        }),
        (error) => error.message === 'STOCK_EXPENSE_CONFLICT' && error.cause === databaseError
    )
})

test('includes product sales in the finance overview without changing revenue sources', async () => {
    reset()
    results.set('rpc:finance_period_totals', {
        data: { revenue_cents: '3000', payments_count: '1', refunds_cents: '0', refunds_count: '0', expense_cents: '0', expenses_count: '0' },
        error: null
    })
    results.set('payments:select', {
        data: [{ id: 'p1', amount: '30.00', paid_at: FROM, source_type: 'product_sale', sale_id: ID }],
        error: null
    })
    results.set('sales:select', { data: [{ id: ID, total_amount: '30.00', sold_at: FROM }], error: null })

    const overview = await financeService.getFinanceOverview('token-1', 'user-1', FROM, TO)

    assert.equal(overview.summary.revenue, 30)
    assert.deepEqual(overview.sales, [{ id: ID, total_amount: '30.00', sold_at: FROM }])
    assert.equal(overview.payments[0].source_type, 'product_sale')
    assert.equal(calls.filter((call) => call.table === 'payments').length >= 1, true)
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
