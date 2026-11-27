import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isWithinWorkingHours, weekdayIndexForDate } from '../src/services/workingHoursRules.js'

const START = '2026-11-26T10:30:00-03:00'
const END = '2026-11-26T11:15:00-03:00'

test('resolves the weekday in America/Fortaleza', () => {
    assert.equal(weekdayIndexForDate(START), 4)
})

test('accepts an interval fully contained in one period', () => {
    assert.equal(isWithinWorkingHours(START, END, [{ opens_at: '09:00', closes_at: '12:00' }]), true)
})

test('accepts an interval in a later period of the same day', () => {
    assert.equal(isWithinWorkingHours(START, END, [
        { opens_at: '08:00', closes_at: '10:00' },
        { opens_at: '10:30', closes_at: '12:00' }
    ]), true)
})

test('rejects an interval outside all periods', () => {
    assert.equal(isWithinWorkingHours(START, END, [{ opens_at: '13:00', closes_at: '14:00' }]), false)
})

test('rejects an interval that crosses the gap between periods', () => {
    assert.equal(isWithinWorkingHours(START, END, [
        { opens_at: '09:00', closes_at: '10:30' },
        { opens_at: '11:00', closes_at: '12:00' }
    ]), false)
})

test('rejects an interval that crosses local midnight', () => {
    assert.equal(isWithinWorkingHours(
        '2026-11-26T23:30:00-03:00',
        '2026-11-27T00:30:00-03:00',
        [{ opens_at: '22:00', closes_at: '23:59' }]
    ), false)
})

test('rejects an empty or inverted interval', () => {
    assert.equal(isWithinWorkingHours(START, START, [{ opens_at: '09:00', closes_at: '12:00' }]), false)
    assert.equal(isWithinWorkingHours(END, START, [{ opens_at: '09:00', closes_at: '12:00' }]), false)
})
