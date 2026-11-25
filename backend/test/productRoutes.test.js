import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const ID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const SOLD_AT = '2026-11-25T10:00:00-03:00'
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

mock.module('../src/services/productService.js', {
    namedExports: {
        listProducts: (...args) => record('listProducts', args),
        createProduct: (...args) => record('createProduct', args),
        updateProduct: (...args) => record('updateProduct', args),
        setProductActive: (...args) => record('setProductActive', args),
        deleteProduct: (...args) => record('deleteProduct', args),
        listMovements: (...args) => record('listMovements', args),
        recordMovement: (...args) => record('recordMovement', args),
        listSales: (...args) => record('listSales', args),
        createSale: (...args) => record('createSale', args),
        refundSale: (...args) => record('refundSale', args)
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

test('requires authentication on every product and sale endpoint', async () => {
    reset()
    const products = await request('/products', { token: null })
    const movements = await request('/products/movements', { token: null })
    const sales = await request('/products/sales', { token: null })

    assert.equal(products.status, 401)
    assert.equal(movements.status, 401)
    assert.equal(sales.status, 401)
    assert.equal(calls.length, 0)
})

test('rejects client-supplied tenant and stock fields on product creation', async () => {
    reset()
    const response = await request('/products', {
        method: 'POST',
        body: { name: 'Pomada', price: '10.00', profileId: 'other-shop' }
    })
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /profileId/)

    const stockResponse = await request('/products', {
        method: 'POST',
        body: { name: 'Pomada', price: '10.00', stock: 99 }
    })
    assert.equal(stockResponse.status, 400)
    assert.equal(calls.length, 0)
})

test('creates products with the authenticated token and maps duplicates to 409', async () => {
    reset()
    implementation = { createProduct: () => ({ id: ID }) }
    const response = await request('/products', {
        method: 'POST',
        body: { name: 'Pomada', price: '12.50', cost: '0.00', sku: 'pomada-01' }
    })

    assert.equal(response.status, 201)
    assert.deepEqual((await response.json()).product, { id: ID })
    assert.deepEqual(calls[0].args, ['valid-token', 'user-1', {
        name: 'Pomada',
        description: null,
        price: '12.50',
        cost: '0.00',
        sku: 'POMADA-01',
        lowStockThreshold: null
    }])

    reset()
    implementation = { createProduct: () => { throw new Error('PRODUCT_DUPLICATE') } }
    const duplicate = await request('/products', {
        method: 'POST',
        body: { name: 'Pomada', price: '12.50' }
    })
    assert.equal(duplicate.status, 409)
})

test('maps insufficient stock to 409 and records a movement with the authenticated user', async () => {
    reset()
    implementation = { recordMovement: () => { throw new Error('ESTOQUE_INSUFICIENTE') } }
    const conflict = await request('/products/movements', {
        method: 'POST',
        body: {
            productId: ID,
            movementType: 'adjustment',
            quantity: 5,
            direction: -1,
            reason: 'Quebra'
        }
    })
    assert.equal(conflict.status, 409)

    reset()
    implementation = { recordMovement: () => ({ id: 'movement-1' }) }
    const created = await request('/products/movements', {
        method: 'POST',
        body: { productId: ID, movementType: 'entry', quantity: 3 }
    })
    assert.equal(created.status, 201)
    assert.deepEqual(calls[0].args[2], {
        productId: ID,
        movementType: 'entry',
        quantity: 3,
        direction: null,
        reason: null,
        note: null
    })
})

test('creates a sale without trusting client prices and validates parameterized ids', async () => {
    reset()
    const result = { sale: { id: ID, total_amount: '25.00' }, paymentId: 'pay-1' }
    implementation = { createSale: () => result }
    const response = await request('/products/sales', {
        method: 'POST',
        body: {
            items: [{ productId: ID, quantity: 2 }],
            paymentMethod: 'Pix',
            soldAt: SOLD_AT,
            idempotencyKey: 'b1b2c3d4-59f0-4d8c-9f0a-112233445566'
        }
    })

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), result)
    assert.deepEqual(calls[0].args[2].items, [{ productId: ID, quantity: 2 }])
    assert.equal(Object.hasOwn(calls[0].args[2], 'amount'), false)

    const invalidId = await request('/products/sales/not-a-uuid/refund', {
        method: 'POST',
        body: { refundedAt: SOLD_AT, reason: 'Devolução' }
    })
    assert.equal(invalidId.status, 400)
    assert.equal(calls.length, 1)
})

test('refunds a sale with a physical return and deletes products with HTTP 204', async () => {
    reset()
    const refund = { refund: { id: 'refund-1' }, restoredQuantity: 2 }
    implementation = { refundSale: () => refund }
    const response = await request(`/products/sales/${ID}/refund`, {
        method: 'POST',
        body: { refundedAt: SOLD_AT, reason: 'Devolução do cliente' }
    })
    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), refund)
    assert.deepEqual(calls[0].args, ['valid-token', 'user-1', ID, {
        refundedAt: SOLD_AT,
        reason: 'Devolução do cliente'
    }])

    reset()
    implementation = { deleteProduct: () => ID }
    const deleted = await request(`/products/${ID}`, { method: 'DELETE' })
    assert.equal(deleted.status, 204)
    assert.deepEqual(calls[0].args, ['valid-token', 'user-1', ID])
})

test('maps a missing barbershop to 404 on product reads', async () => {
    reset()
    implementation = { listProducts: () => { throw new Error('BARBERSHOP_NOT_FOUND') } }
    const response = await request('/products')
    assert.equal(response.status, 404)
})
