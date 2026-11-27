import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
    validateMovementPayload,
    validateMovementProductFilter,
    validateProductActivePayload,
    validateProductId,
    validateProductPayload,
    validateSalePayload,
    validateSalePeriod,
    validateSaleRefundPayload
} from '../src/validation/productValidation.js'

const ID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const OTHER_ID = '7d7c9f3a-59f0-4d8c-9f0a-112233445566'
const SOLD_AT = '2026-11-25T10:00:00-03:00'

test('normalizes product fields and rejects tenant-controlled fields', () => {
    const result = validateProductPayload({
        name: '  Pomada  ',
        description: '  Fixação forte  ',
        price: '12.50',
        cost: 0,
        sku: ' pomada-01 ',
        lowStockThreshold: 3
    })

    assert.equal(result.error, undefined)
    assert.deepEqual(result.payload, {
        name: 'Pomada',
        description: 'Fixação forte',
        price: '12.50',
        cost: '0.00',
        sku: 'POMADA-01',
        lowStockThreshold: 3
    })
    assert.match(validateProductPayload({ name: 'Pomada', price: '1.00', profileId: 'other' }).error, /profileId/)
    assert.match(validateProductPayload({ name: 'Pomada', price: '1.00', stock: 10 }).error, /stock/)
    assert.match(validateProductPayload({ name: 'Pomada', price: '1.00', isActive: false }).error, /isActive/)
})

test('validates product money, threshold and optional values', () => {
    assert.match(validateProductPayload({ name: 'Pomada', price: '0' }).error, /0,01/)
    assert.match(validateProductPayload({ name: 'Pomada', price: '12.123' }).error, /duas casas/)
    assert.match(validateProductPayload({ name: 'Pomada', price: '12.00', cost: '-1' }).error, /duas casas/)
    assert.match(validateProductPayload({ name: 'Pomada', price: '12.00', lowStockThreshold: -1 }).error, /lowStockThreshold/)
    assert.equal(validateProductPayload({ name: 'Pomada', price: 12 }).payload.cost, null)
})

test('validates stock entries and adjustments', () => {
    assert.deepEqual(validateMovementPayload({
        productId: ID,
        movementType: 'entry',
        quantity: 5,
        note: 'Nota 123'
    }).payload, {
        productId: ID,
        movementType: 'entry',
        quantity: 5,
        direction: null,
        reason: null,
        note: 'Nota 123'
    })

    const adjustment = validateMovementPayload({
        productId: ID,
        movementType: 'adjustment',
        quantity: 2,
        direction: -1,
        reason: 'Quebra'
    })
    assert.equal(adjustment.error, undefined)
    assert.equal(adjustment.payload.direction, -1)
    assert.match(validateMovementPayload({
        productId: ID,
        movementType: 'adjustment',
        quantity: 2,
        direction: -1
    }).error, /motivo/)
    assert.match(validateMovementPayload({
        productId: ID,
        movementType: 'entry',
        quantity: 2,
        direction: -1
    }).error, /negativa/)
    assert.match(validateMovementPayload({
        productId: ID,
        movementType: 'entry',
        quantity: 1,
        profileId: 'other'
    }).error, /profileId/)
})

test('validates sale items without accepting prices or amounts from the client', () => {
    const result = validateSalePayload({
        items: [
            { productId: ID, quantity: 2 },
            { productId: OTHER_ID, quantity: '1' }
        ],
        paymentMethod: 'Pix',
        soldAt: SOLD_AT,
        note: 'Cliente freqüente',
        idempotencyKey: 'b1b2c3d4-59f0-4d8c-9f0a-112233445566'
    })

    assert.equal(result.error, undefined)
    assert.deepEqual(result.payload.items, [
        { productId: ID, quantity: 2 },
        { productId: OTHER_ID, quantity: 1 }
    ])
    assert.equal(result.payload.soldAt, SOLD_AT)
    assert.match(validateSalePayload({
        items: [{ productId: ID, quantity: 1, price: '1.00' }],
        paymentMethod: 'Pix',
        soldAt: SOLD_AT
    }).error, /price/)
    assert.match(validateSalePayload({
        items: [{ productId: ID, quantity: 1 }],
        paymentMethod: 'Pix'
    }).error, /soldAt/)
    assert.match(validateSalePayload({
        items: [{ productId: ID, quantity: 1 }, { productId: ID, quantity: 2 }],
        paymentMethod: 'Pix',
        soldAt: SOLD_AT
    }).error, /repita/)
})

test('validates sale refunds as an explicit physical return', () => {
    assert.deepEqual(validateSaleRefundPayload({
        refundedAt: SOLD_AT,
        reason: 'Devolução do cliente'
    }).payload, {
        refundedAt: SOLD_AT,
        reason: 'Devolução do cliente'
    })
    assert.match(validateSaleRefundPayload({ refundedAt: SOLD_AT }).error, /reason/)
    assert.match(validateSaleRefundPayload({ refundedAt: 'ontem', reason: 'A' }).error, /refundedAt/)
})

test('validates ids, active flag, filters and sale periods', () => {
    assert.equal(validateProductId(ID), true)
    assert.equal(validateProductId('bad-id'), false)
    assert.deepEqual(validateProductActivePayload({ isActive: false }).payload, { isActive: false })
    assert.match(validateProductActivePayload({ isActive: 'sim' }).error, /booleano/)
    assert.deepEqual(validateMovementProductFilter({ productId: ID }), { productId: ID })
    assert.match(validateMovementProductFilter({ productId: 'bad' }).error, /productId/)
    assert.deepEqual(validateSalePeriod({ from: '2026-11-01T00:00:00-03:00', to: SOLD_AT }).period.from, '2026-11-01T00:00:00-03:00')
    assert.match(validateSalePeriod({ from: SOLD_AT, to: SOLD_AT }).error, /anterior/)
})
