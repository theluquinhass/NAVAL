import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
    isStrictIsoDateTime,
    isUuid,
    rejectExtraFields,
    validateBusinessDate,
    validateMoney,
    validateOptionalText,
    validatePagination,
    validatePeriod
} from '../src/validation/shared.js'

const UUID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const NOW = Date.parse('2026-11-25T00:00:00Z')

test('validates UUIDs and strict ISO 8601 datetimes with explicit offsets', () => {
    assert.equal(isUuid(UUID), true)
    assert.equal(isUuid(UUID.toUpperCase()), true)
    assert.equal(isUuid('not-a-uuid'), false)
    assert.equal(isUuid(null), false)

    assert.equal(isStrictIsoDateTime('2026-11-25T10:00:00-03:00'), true)
    assert.equal(isStrictIsoDateTime('2026-11-25T13:00:00Z'), true)
    assert.equal(isStrictIsoDateTime('2026-11-25T13:00:00.123456789Z'), true)
    assert.equal(isStrictIsoDateTime('2026-11-25'), false)
    assert.equal(isStrictIsoDateTime('2026-11-25T13:00:00'), false)
    assert.equal(isStrictIsoDateTime('2026-02-30T13:00:00Z'), false)
    assert.equal(isStrictIsoDateTime('2026-11-25T25:00:00Z'), false)
    assert.equal(isStrictIsoDateTime('2026-11-25T13:00:00+15:00'), false)
})

test('normalizes money and optional text', () => {
    assert.deepEqual(validateMoney('12.5', 'amount'), { amount: '12.50' })
    assert.deepEqual(validateMoney(0, 'cost', { allowZero: true }), { amount: '0.00' })
    assert.match(validateMoney('10.123', 'amount').error, /duas casas/)
    assert.match(validateMoney(-1, 'amount').error, /duas casas/)
    assert.match(validateMoney('100000000', 'amount').error, /99999999.99/)

    assert.deepEqual(validateOptionalText('  Pomada  ', 'name', 10), { text: 'Pomada' })
    assert.deepEqual(validateOptionalText('', 'name', 10), { text: null })
    assert.match(validateOptionalText('12345678901', 'name', 10).error, /10 caracteres/)
    assert.equal(rejectExtraFields({ name: 'a', profileId: 'b' }, new Set(['name'])), 'Campo(s) não permitido(s): profileId.')
})

test('limits periods to 366 days and requires an increasing interval', () => {
    const from = '2026-01-01T00:00:00Z'
    assert.deepEqual(validatePeriod({ from, to: '2027-01-02T00:00:00Z' }), {
        period: { from, to: '2027-01-02T00:00:00Z' }
    })
    assert.match(validatePeriod({ from, to: '2027-01-03T00:00:00Z' }).error, /366 dias/)
    assert.match(validatePeriod({ from, to: from }).error, /anterior/)
    assert.match(validatePeriod({ from: '2026-01-01', to: '2026-02-01' }).error, /ISO 8601/)
})

test('limits creation dates to five years past and one day ahead', () => {
    assert.deepEqual(validateBusinessDate('2026-11-25T00:00:00Z', 'paidAt', { now: NOW }), {
        date: '2026-11-25T00:00:00Z'
    })
    assert.match(validateBusinessDate('2021-11-24T23:59:59Z', 'paidAt', { now: NOW }).error, /5 anos/)
    assert.match(validateBusinessDate('2026-11-26T00:00:01Z', 'paidAt', { now: NOW }).error, /1 dia/)
    assert.match(validateBusinessDate('yesterday', 'paidAt', { now: NOW }).error, /ISO 8601/)
})

test('defaults pagination to 500/0 and validates supplied values', () => {
    assert.deepEqual(validatePagination({}), { pagination: { limit: 500, offset: 0 } })
    assert.deepEqual(validatePagination({ limit: '1000', offset: '25' }), {
        pagination: { limit: 1000, offset: 25 }
    })
    assert.match(validatePagination({ limit: '1001' }).error, /1 e 1000/)
    assert.match(validatePagination({ offset: '-1' }).error, /inteiro/)
    assert.match(validatePagination({ limit: 'abc' }).error, /inteiro/)
})
