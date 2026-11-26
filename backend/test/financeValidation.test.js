import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
    validateCategoryPayload,
    validateExpensePayload,
    validateFinanceId,
    validatePaymentPayload,
    validatePeriod,
    validateRefundPayload
} from '../src/validation/financeValidation.js'

const ID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const KEY = 'b1b2c3d4-59f0-4d8c-9f0a-112233445566'
const PERIOD = { from: '2026-11-01T00:00:00-03:00', to: '2026-12-01T00:00:00-03:00' }
const RECENT = new Date(Date.now() - 60_000).toISOString()
const TOO_OLD = new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000).toISOString()
const TOO_FAR_AHEAD = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

test('accepts a period with explicit offsets', () => {
    assert.deepEqual(validatePeriod(PERIOD), { period: PERIOD })
})

test('rejects periods without timezone, inverted or longer than one year', () => {
    assert.match(validatePeriod({ from: '2026-11-01', to: '2026-12-01' }).error, /ISO 8601/)
    assert.match(validatePeriod({ from: PERIOD.to, to: PERIOD.from }).error, /anterior/)
    assert.match(validatePeriod({ from: '2025-11-01T00:00:00-03:00', to: PERIOD.to }).error, /366 dias/)
    assert.match(validatePeriod({ from: '2026-02-30T00:00:00-03:00', to: PERIOD.to }).error, /ISO 8601/)
})

test('accepts partial payments with an amount different from any catalog price', () => {
    const result = validatePaymentPayload({
        appointmentId: ID,
        amount: '12.35',
        paidAt: RECENT,
        method: 'Pix',
        note: 'Entrada combinada'
    })

    assert.equal(result.error, undefined)
    assert.deepEqual(result.payload, {
        appointmentId: ID,
        amount: '12.35',
        paidAt: RECENT,
        method: 'Pix',
        note: 'Entrada combinada',
        idempotencyKey: null
    })
})

test('allows a payment without an appointment and strips unknown fields', () => {
    const result = validatePaymentPayload({
        amount: 50,
        paidAt: RECENT,
        method: 'Dinheiro',
        profileId: 'another-shop-id'
    })

    assert.match(result.error, /profileId/)
    assert.equal(validatePaymentPayload({ amount: 50, paidAt: RECENT, method: 'Dinheiro' }).payload.appointmentId, null)
})

test('accepts and validates an optional payment/refund idempotency key', () => {
    const payment = validatePaymentPayload({ amount: '10.00', paidAt: RECENT, method: 'Pix', idempotencyKey: KEY })
    assert.equal(payment.payload.idempotencyKey, KEY)

    const refund = validateRefundPayload({ paymentId: ID, amount: '5.00', refundedAt: RECENT, idempotencyKey: KEY })
    assert.equal(refund.payload.idempotencyKey, KEY)

    assert.match(validatePaymentPayload({ amount: '10.00', paidAt: RECENT, method: 'Pix', idempotencyKey: 'bad' }).error, /idempotencyKey/)
    assert.match(validateRefundPayload({ paymentId: ID, amount: '5.00', refundedAt: RECENT, idempotencyKey: 123 }).error, /idempotencyKey/)
})

test('rejects invalid money values', () => {
    assert.match(validatePaymentPayload({ amount: '10.123', paidAt: RECENT, method: 'Pix' }).error, /duas casas/)
    assert.match(validatePaymentPayload({ amount: 0, paidAt: RECENT, method: 'Pix' }).error, /0,01/)
    assert.match(validatePaymentPayload({ amount: -5, paidAt: RECENT, method: 'Pix' }).error, /duas casas/)
    assert.match(validatePaymentPayload({ amount: '', paidAt: RECENT, method: 'Pix' }).error, /duas casas/)
})

test('validates refunds as explicit events', () => {
    assert.deepEqual(validateRefundPayload({
        paymentId: ID,
        amount: '5.00',
        refundedAt: RECENT,
        reason: 'Cancelamento'
    }).payload, {
        paymentId: ID,
        amount: '5.00',
        refundedAt: RECENT,
        reason: 'Cancelamento',
        idempotencyKey: null
    })

    assert.match(validateRefundPayload({ amount: '5.00', refundedAt: RECENT }).error, /paymentId/)
    assert.match(validateRefundPayload({ paymentId: ID, amount: '5.00', refundedAt: 'ontem' }).error, /refundedAt/)
})

test('limits creation dates to five years in the past and one day in the future', () => {
    assert.match(validatePaymentPayload({ amount: '10.00', paidAt: TOO_OLD, method: 'Pix' }).error, /5 anos/)
    assert.match(validatePaymentPayload({ amount: '10.00', paidAt: TOO_FAR_AHEAD, method: 'Pix' }).error, /1 dia/)
    assert.match(validateRefundPayload({ paymentId: ID, amount: '5.00', refundedAt: TOO_FAR_AHEAD }).error, /1 dia/)
    assert.match(validateExpensePayload({ description: 'Cafeina', amount: '5.00', spentAt: TOO_OLD }).error, /5 anos/)
})

test('validates expenses and editable categories', () => {
    const expense = validateExpensePayload({
        categoryId: ID,
        description: 'Cafeina',
        amount: '18.90',
        spentAt: RECENT,
        paymentMethod: 'Cartao',
        note: 'Nota fiscal 123'
    })
    assert.equal(expense.error, undefined)
    assert.equal(expense.payload.categoryId, ID)

    assert.match(validateExpensePayload({ amount: '1.00', spentAt: RECENT }).error, /descrição/)
    assert.deepEqual(validateCategoryPayload({ name: 'Insumos' }).payload, { name: 'Insumos', isActive: true })
    assert.match(validateCategoryPayload({ name: 'Insumos', isActive: 'sim' }).error, /booleano/)
    assert.match(validateCategoryPayload({ name: '   ' }).error, /nome/)
})

test('validates finance ids', () => {
    assert.equal(validateFinanceId(ID), true)
    assert.equal(validateFinanceId('not-a-uuid'), false)
    assert.equal(validateFinanceId(null), false)
})
