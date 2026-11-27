import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fromCents, sumCents, toCents } from '../src/services/money.js'

test('converts reais to cents with integer rounding', () => {
    assert.equal(toCents('12.35'), 1235)
    assert.equal(toCents(0.1), 10)
    assert.equal(toCents('12.345'), 1235)
})

test('converts cents to reais without floating point artifacts', () => {
    assert.equal(fromCents(1235), 12.35)
    assert.equal(fromCents(-1235), -12.35)
    assert.equal(fromCents(0), 0)
    assert.equal(fromCents(1890), 18.9)
})

test('sums rows by a monetary column using integer cents', () => {
    assert.equal(sumCents([{ amount: '10.00' }, { amount: '5.50' }, { amount: '-2.25' }], 'amount'), 1325)
})
