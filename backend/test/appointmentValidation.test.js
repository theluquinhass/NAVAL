import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAppointmentPayload } from '../src/validation/appointmentValidation.js'

const validPayload = {
    customerName: '  Ana Souza  ',
    customerPhone: ' +55 (85) 99999-1234 ',
    serviceId: '8d8c9f3a-59f0-4d8c-9f0a-112233445566',
    startsAt: '2026-11-26T10:30:00-03:00'
}

test('accepts valid appointment payload and trims customer fields', () => {
    assert.deepEqual(validateAppointmentPayload(validPayload), {
        payload: {
            ...validPayload,
            customerName: 'Ana Souza',
            customerPhone: '+55 (85) 99999-1234'
        }
    })
})

test('accepts an ISO datetime with Z and fractional seconds', () => {
    const result = validateAppointmentPayload({ ...validPayload, startsAt: '2026-11-26T13:30:00.250Z' })
    assert.equal(result.payload.startsAt, '2026-11-26T13:30:00.250Z')
})

test('rejects missing required fields', () => {
    const { startsAt, ...missingStart } = validPayload
    assert.match(validateAppointmentPayload(missingStart).error, /startsAt é obrigatório/)
    assert.match(validateAppointmentPayload(undefined).error, /objeto/)
})

test('rejects an empty or whitespace-only customer name', () => {
    for (const customerName of ['', '   ']) {
        assert.match(validateAppointmentPayload({ ...validPayload, customerName }).error, /customerName não pode estar vazio/)
    }
})

test('rejects customer names longer than 100 characters', () => {
    assert.match(validateAppointmentPayload({ ...validPayload, customerName: 'a'.repeat(101) }).error, /no máximo 100/)
})

test('rejects invalid phones and phones outside the digit limits', () => {
    for (const customerPhone of ['abc1234567', '123-456', '1234567890123456', '-------1234567', '1234567-']) {
        assert.match(validateAppointmentPayload({ ...validPayload, customerPhone }).error, /customerPhone/)
    }
})

test('rejects a non-string phone', () => {
    assert.match(validateAppointmentPayload({ ...validPayload, customerPhone: 85999991234 }).error, /customerPhone deve ser um texto/)
})

test('rejects malformed service UUIDs', () => {
    for (const serviceId of ['service-1', '8d8c9f3a-59f0-4d8c-9f0a-11223344556g', 123]) {
        assert.match(validateAppointmentPayload({ ...validPayload, serviceId }).error, /serviceId/)
    }
})

test('rejects impossible calendar dates and invalid time or offset values', () => {
    for (const startsAt of [
        '2026-02-30T10:30:00Z',
        '2026-11-26T24:00:00Z',
        '2026-11-26T10:30:00+14:30',
        'not-a-date'
    ]) {
        assert.match(validateAppointmentPayload({ ...validPayload, startsAt }).error, /startsAt/)
    }
})

test('rejects datetimes without an explicit timezone', () => {
    for (const startsAt of ['2026-11-26T10:30:00', '2026-11-26T10:30:00.000']) {
        assert.match(validateAppointmentPayload({ ...validPayload, startsAt }).error, /timezone explícito/)
    }
})

test('rejects fields that the client is not allowed to submit', () => {
    for (const field of ['profile_id', 'ends_at', 'status']) {
        assert.match(validateAppointmentPayload({ ...validPayload, [field]: 'forbidden' }).error, /não permitido/)
    }
})

test('rejects incorrect payload field types', () => {
    for (const [field, value] of [
        ['customerName', null],
        ['customerPhone', []],
        ['serviceId', null],
        ['startsAt', 1795707000000]
    ]) {
        assert.ok(validateAppointmentPayload({ ...validPayload, [field]: value }).error, `${field} should be rejected`)
    }
})

test('rejects non-object payloads', () => {
    for (const body of [null, [], 'payload']) {
        assert.ok(validateAppointmentPayload(body).error)
    }
})
