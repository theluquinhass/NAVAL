import test from 'node:test'
import assert from 'node:assert/strict'
import { validateWorkingHoursRows } from '../src/validation/workingHoursValidation.js'

test('accepts multiple ordered, non-overlapping periods in one day', () => {
    const rows = [
        { day_of_week: 1, period_index: 0, opens_at: '09:00', closes_at: '11:00' },
        { day_of_week: 1, period_index: 1, opens_at: '14:00', closes_at: '18:00' }
    ]
    assert.deepEqual(validateWorkingHoursRows(rows), { rows })
})

test('allows a fully closed week', () => {
    assert.deepEqual(validateWorkingHoursRows([]), { rows: [] })
})

test('rejects overlapping periods', () => {
    const result = validateWorkingHoursRows([
        { day_of_week: 1, period_index: 0, opens_at: '09:00', closes_at: '12:00' },
        { day_of_week: 1, period_index: 1, opens_at: '11:30', closes_at: '14:00' }
    ])
    assert.match(result.error, /não podem se sobrepor/)
})

test('rejects periods with invalid or reversed times', () => {
    for (const period of [
        { day_of_week: 1, period_index: 0, opens_at: '09:00', closes_at: '09:00' },
        { day_of_week: 1, period_index: 0, opens_at: '18:00', closes_at: '17:00' },
        { day_of_week: 1, period_index: 0, opens_at: '9:00', closes_at: '17:00' }
    ]) {
        assert.match(validateWorkingHoursRows([period]).error, /horário|início|término/i)
    }
})

test('requires consecutive period indexes within each day', () => {
    const result = validateWorkingHoursRows([
        { day_of_week: 1, period_index: 1, opens_at: '14:00', closes_at: '18:00' }
    ])
    assert.match(result.error, /numerados em sequência/)
})
