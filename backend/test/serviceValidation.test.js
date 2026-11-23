import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateServicePayload } from '../src/validation/serviceValidation.js'

const validPayload = { name: '  Corte  ', price: 25.5, duration: 30 }

test('normalizes valid name and empty description', () => {
    const result = validateServicePayload({ ...validPayload, description: '  ' })

    assert.deepEqual(result, {
        payload: { name: 'Corte', description: null, price: 25.5, duration: 30 }
    })
})

test('accepts null or omitted description', () => {
    assert.equal(validateServicePayload({ ...validPayload, description: null }).payload.description, null)
    assert.equal(validateServicePayload(validPayload).payload.description, null)
})

test('rejects missing, non-string, and blank names', () => {
    for (const name of [undefined, null, 12, '   ']) {
        assert.match(validateServicePayload({ ...validPayload, name }).error, /name/)
    }
})

test('rejects descriptions that are neither strings nor null', () => {
    for (const description of [12, false, {}]) {
        assert.match(validateServicePayload({ ...validPayload, description }).error, /description/)
    }
})

test('accepts prices with at most two decimal places and within NUMERIC(10,2)', () => {
    for (const price of [0.01, 1.15, 99999999.99]) {
        assert.equal(validateServicePayload({ ...validPayload, price }).payload.price, price)
    }
})

test('rejects invalid, non-positive, over-precision, and out-of-range prices', () => {
    for (const price of [0, -1, 1.234, NaN, Infinity, '10', 'abc', 100000000]) {
        assert.match(validateServicePayload({ ...validPayload, price }).error, /price/)
    }
})

test('accepts only positive integer durations', () => {
    assert.equal(validateServicePayload({ ...validPayload, duration: 1 }).payload.duration, 1)
    for (const duration of [0, -1, 1.5, NaN, Infinity, '30', 'abc']) {
        assert.match(validateServicePayload({ ...validPayload, duration }).error, /duration/)
    }
})

test('rejects a non-object request body', () => {
    for (const body of [undefined, null, [], 'payload']) {
        assert.ok(validateServicePayload(body).error)
    }
})
