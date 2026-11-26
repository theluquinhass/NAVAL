import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { clearProfileCache } from '../src/services/barbershopService.js'

const ID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const FROM = '2026-11-01T00:00:00-03:00'
const TO = '2026-12-01T00:00:00-03:00'

const calls = []
const results = new Map()

function resultFor(key) {
    return results.get(key) ?? { data: [], error: null }
}

function queryFor(table, call) {
    return {
        select(columns, options) {
            call.selected = columns
            call.selectOptions = options
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
        in(column, values) {
            call.filters.push([`${column} in`, values])
            return this
        },
        order(column, options) {
            call.order = { column, options }
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
            return Promise.resolve(resultFor(`${table}:select`))
        },
        maybeSingle() {
            return Promise.resolve(resultFor(`${table}:select`))
        },
        then(resolve, reject) {
            return Promise.resolve(resultFor(`${table}:select`)).then(resolve, reject)
        }
    }
}

const supabase = {
    from(table) {
        const call = { table, filters: [] }
        calls.push(call)
        return queryFor(table, call)
    },
    rpc(name, args) {
        const call = { rpc: name, args }
        calls.push(call)
        return Promise.resolve(resultFor(`rpc:${name}`))
    }
}

mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: {},
        createPublicClient: () => { throw new Error('Products must not use the public client') },
        createUserClient: (token) => {
            assert.equal(token, 'token-1')
            return supabase
        }
    }
})

let productService
before(async () => {
    productService = await import('../src/services/productService.js')
})

after(() => mock.restoreAll())

function reset() {
    calls.length = 0
    results.clear()
    results.set('barbershops:select', { data: { id: 'shop-1' }, error: null })
    clearProfileCache()
}

test('reads the catalog through the database function without client tenant input', async () => {
    reset()
    const catalog = [{ id: ID, name: 'Pomada', stock: 4 }]
    results.set('rpc:products_list_catalog', { data: catalog, error: null })

    const products = await productService.listProducts('token-1', 'user-1')

    assert.deepEqual(products, catalog)
    assert.equal(calls[0].table, 'barbershops')
    assert.deepEqual(calls[1], { rpc: 'products_list_catalog', args: undefined })
})

test('creates products through RPC with server-derived tenant and normalized fields', async () => {
    reset()
    const created = { id: ID, name: 'Pomada' }
    results.set('rpc:products_create_product', { data: created, error: null })

    const product = await productService.createProduct('token-1', 'user-1', {
        name: 'Pomada',
        description: null,
        price: '12.50',
        cost: '0.00',
        sku: 'POMADA-01',
        lowStockThreshold: 3
    })

    assert.deepEqual(product, created)
    assert.deepEqual(calls[1], {
        rpc: 'products_create_product',
        args: {
            p_name: 'Pomada',
            p_description: null,
            p_price: '12.50',
            p_cost: '0.00',
            p_sku: 'POMADA-01',
            p_low_stock_threshold: 3
        }
    })
    assert.equal(Object.hasOwn(calls[1].args, 'profile_id'), false)
})

test('maps duplicate SKUs and missing products to domain errors', async () => {
    reset()
    results.set('rpc:products_create_product', { data: null, error: { code: '23505', message: 'duplicate key' } })
    await assert.rejects(
        productService.createProduct('token-1', 'user-1', { name: 'Pomada', price: '1.00' }),
        { message: 'PRODUCT_DUPLICATE' }
    )

    reset()
    const notFound = { code: 'P0002', message: 'PRODUCT_NOT_FOUND' }
    results.set('rpc:products_update_product', { data: null, error: notFound })
    await assert.rejects(
        productService.updateProduct('token-1', 'user-1', ID, { name: 'Pomada', price: '1.00' }),
        (error) => error.message === 'PRODUCT_NOT_FOUND' && error.cause === notFound
    )
})

test('maps stock conflicts and preserves the original database error', async () => {
    reset()
    const conflict = { code: '22023', message: 'ESTOQUE_INSUFICIENTE' }
    results.set('rpc:products_record_movement', { data: null, error: conflict })
    await assert.rejects(
        productService.recordMovement('token-1', 'user-1', {
            productId: ID,
            movementType: 'adjustment',
            quantity: 5,
            direction: -1,
            reason: 'Quebra'
        }),
        (error) => error.message === 'ESTOQUE_INSUFICIENTE' && error.cause === conflict
    )

    reset()
    results.set('rpc:products_create_sale', { data: null, error: { code: '22023', message: 'PRODUCT_INACTIVE' } })
    await assert.rejects(
        productService.createSale('token-1', 'user-1', { items: [{ productId: ID, quantity: 1 }] }),
        { message: 'PRODUCT_INACTIVE' }
    )
})

test('maps a missing product cost to a domain error for stock entries', async () => {
    reset()
    const costError = { code: '22023', message: 'PRODUCT_COST_REQUIRED' }
    results.set('rpc:products_record_movement', { data: null, error: costError })
    await assert.rejects(
        productService.recordMovement('token-1', 'user-1', {
            productId: ID,
            movementType: 'entry',
            quantity: 10,
            direction: null,
            reason: null,
            note: null
        }),
        (error) => error.message === 'PRODUCT_COST_REQUIRED' && error.cause === costError
    )
})

test('creates sales through RPC without sending client-supplied money', async () => {
    reset()
    const result = { sale: { id: ID, total_amount: '25.00' }, paymentId: 'pay-1' }
    results.set('rpc:products_create_sale', { data: result, error: null })

    const created = await productService.createSale('token-1', 'user-1', {
        items: [{ productId: ID, quantity: 2 }],
        paymentMethod: 'Pix',
        soldAt: FROM,
        note: null,
        idempotencyKey: 'b1b2c3d4-59f0-4d8c-9f0a-112233445566'
    })

    assert.deepEqual(created, result)
    assert.deepEqual(calls[1].args, {
        p_items: [{ productId: ID, quantity: 2 }],
        p_payment_method: 'Pix',
        p_sold_at: FROM,
        p_idempotency_key: 'b1b2c3d4-59f0-4d8c-9f0a-112233445566',
        p_note: null
    })
    assert.equal(Object.hasOwn(calls[1].args, 'amount'), false)
})

test('maps idempotency conflicts and refunds a sale with an explicit reason', async () => {
    reset()
    results.set('rpc:products_create_sale', { data: null, error: { code: '23505', message: 'duplicate key' } })
    await assert.rejects(
        productService.createSale('token-1', 'user-1', { items: [], paymentMethod: 'Pix', soldAt: FROM }),
        { message: 'SALE_IDEMPOTENCY_CONFLICT' }
    )

    reset()
    const refund = { refund: { id: 'refund-1' }, restoredQuantity: 2 }
    results.set('rpc:products_refund_sale', { data: refund, error: null })
    const result = await productService.refundSale('token-1', 'user-1', ID, {
        refundedAt: TO,
        reason: 'Devolução do cliente'
    })
    assert.deepEqual(result, refund)
    assert.deepEqual(calls[1], {
        rpc: 'products_refund_sale',
        args: { p_sale_id: ID, p_refunded_at: TO, p_reason: 'Devolução do cliente' }
    })
})

test('scopes movements and sales to the authenticated profile', async () => {
    reset()
    results.set('inventory_movements:select', { data: [{ id: 'movement-1' }], error: null })
    const movements = await productService.listMovements('token-1', 'user-1', ID)
    assert.equal(movements.length, 1)
    assert.deepEqual(calls[1].filters, [['profile_id', 'shop-1'], ['product_id', ID]])
    assert.deepEqual(calls[1].range, [0, 499])

    reset()
    results.set('sales:select', { data: [{ id: ID }], error: null })
    const sales = await productService.listSales('token-1', 'user-1', FROM, TO)
    assert.equal(sales.length, 1)
    assert.deepEqual(calls[1].filters, [
        ['profile_id', 'shop-1'],
        [`sold_at >=`, FROM],
        [`sold_at <`, TO]
    ])
})

test('builds a product finance overview from sales, sale payments, refunds and stock purchases', async () => {
    reset()
    results.set('rpc:products_finance_period_totals', {
        data: {
            gross_revenue_cents: '3000',
            payments_count: '1',
            refunds_cents: '500',
            refunds_count: '1',
            purchase_expenses_cents: '10000',
            purchases_count: '1',
            sales_count: '1'
        },
        error: null
    })
    results.set('sales:select', {
        data: [{ id: ID, sold_at: FROM, status: 'completed', total_amount: '30.00' }],
        error: null
    })
    results.set('payments:select', {
        data: [{ id: 'pay-1', sale_id: ID, amount: '30.00', paid_at: FROM, source_type: 'product_sale' }],
        error: null
    })
    results.set('payment_refunds:select', {
        data: [{ id: 'refund-1', payment_id: 'pay-1', amount: '5.00', refunded_at: TO }],
        error: null
    })
    results.set('expenses:select', {
        data: [{ id: 'expense-1', amount: '100.00', spent_at: FROM, source_type: 'stock_entry' }],
        error: null
    })

    const overview = await productService.getProductFinanceOverview('token-1', 'user-1', FROM, TO)

    assert.deepEqual(overview.summary, {
        grossRevenue: 30,
        refunds: 5,
        netRevenue: 25,
        purchaseExpenses: 100,
        balance: -75,
        salesCount: 1,
        paymentsCount: 1,
        refundsCount: 1,
        purchasesCount: 1
    })
    assert.equal(overview.sales.length, 1)
    assert.equal(overview.payments[0].source_type, 'product_sale')
    assert.equal(overview.purchases[0].source_type, 'stock_entry')

    const paymentCall = calls.find((call) => call.table === 'payments')
    const purchaseCall = calls.find((call) => call.table === 'expenses')
    const refundCall = calls.find((call) => call.table === 'payment_refunds')
    assert.deepEqual(calls.find((call) => call.rpc === 'products_finance_period_totals'), {
        rpc: 'products_finance_period_totals',
        args: { p_profile_id: 'shop-1', p_from: FROM, p_to: TO }
    })
    assert.ok(paymentCall.filters.some(([column, value]) => column === 'source_type' && value === 'product_sale'))
    assert.ok(purchaseCall.filters.some(([column, value]) => column === 'source_type' && value === 'stock_entry'))
    assert.deepEqual(refundCall.filters.find(([column]) => column === 'payment_id in')[1], ['pay-1'])
    assert.ok(refundCall.filters.some(([column, value]) => column === 'refunded_at >=' && value === FROM))
    assert.ok(refundCall.filters.some(([column, value]) => column === 'refunded_at <' && value === TO))
})

test('fails closed when the authenticated user has no barbershop', async () => {
    reset()
    results.set('barbershops:select', { data: null, error: null })

    await assert.rejects(
        productService.listProducts('token-1', 'user-1'),
        { message: 'BARBERSHOP_NOT_FOUND' }
    )
    assert.equal(calls.length, 1)
})
