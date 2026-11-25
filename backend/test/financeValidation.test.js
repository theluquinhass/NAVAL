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
const PERIOD = { from: '2026-11-01T00:00:00-03:00', to: '2026-12-01T00:00:00-03:00' }

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
        paidAt: '2026-11-25T10:00:00-03:00',
        method: 'Pix',
        note: 'Entrada combinada'
    })

    assert.equal(result.error, undefined)
    assert.deepEqual(result.payload, {
        appointmentId: ID,
        amount: '12.35',
        paidAt: '2026-11-25T10:00:00-03:00',
        method: 'Pix',
        note: 'Entrada combinada'
    })
})

test('allows a payment without an appointment and strips unknown fields', () => {
    const result = validatePaymentPayload({
        amount: 50,
        paidAt: '2026-11-25T10:00:00-03:00',
        method: 'Dinheiro',
        profileId: 'another-shop-id'
    })

    assert.match(result.error, /profileId/)
    assert.equal(validatePaymentPayload({ amount: 50, paidAt: PERIOD.from, method: 'Dinheiro' }).payload.appointmentId, null)
})

test('rejects invalid money values', () => {
    assert.match(validatePaymentPayload({ amount: '10.123', paidAt: PERIOD.from, method: 'Pix' }).error, /duas casas/)
    assert.match(validatePaymentPayload({ amount: 0, paidAt: PERIOD.from, method: 'Pix' }).error, /0,01/)
    assert.match(validatePaymentPayload({ amount: -5, paidAt: PERIOD.from, method: 'Pix' }).error, /duas casas/)
    assert.match(validatePaymentPayload({ amount: '', paidAt: PERIOD.from, method: 'Pix' }).error, /duas casas/)
})

test('validates refunds as explicit events', () => {
    assert.deepEqual(validateRefundPayload({
        paymentId: ID,
        amount: '5.00',
        refundedAt: '2026-11-26T10:00:00-03:00',
        reason: 'Cancelamento'
    }).payload, {
        paymentId: ID,
        amount: '5.00',
        refundedAt: '2026-11-26T10:00:00-03:00',
        reason: 'Cancelamento'
    })

    assert.match(validateRefundPayload({ amount: '5.00', refundedAt: PERIOD.from }).error, /paymentId/)
    assert.match(validateRefundPayload({ paymentId: ID, amount: '5.00', refundedAt: 'ontem' }).error, /refundedAt/)
})

test('validates expenses and editable categories', () => {
    const expense = validateExpensePayload({
        categoryId: ID,
        description: 'Cafeina',
        amount: '18.90',
        spentAt: '2026-11-25T09:00:00-03:00',
        paymentMethod: 'Cartao',
        note: 'Nota fiscal 123'
    })
    assert.equal(expense.error, undefined)
    assert.equal(expense.payload.categoryId, ID)

    assert.match(validateExpensePayload({ amount: '1.00', spentAt: PERIOD.from }).error, /descrição/)
    assert.deepEqual(validateCategoryPayload({ name: 'Insumos' }).payload, { name: 'Insumos', isActive: true })
    assert.match(validateCategoryPayload({ name: 'Insumos', isActive: 'sim' }).error, /booleano/)
    assert.match(validateCategoryPayload({ name: '   ' }).error, /nome/)
})

test('validates finance ids', () => {
    assert.equal(validateFinanceId(ID), true)
    assert.equal(validateFinanceId('not-a-uuid'), false)
    assert.equal(validateFinanceId(null), false)
})
