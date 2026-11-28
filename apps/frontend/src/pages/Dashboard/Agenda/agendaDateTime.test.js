import { describe, expect, it } from 'vitest'
import { fortalezaToday } from '../../../utils/dashboard.js'
import { getLocalDateValue, getWeekDays, getWeekRange, shiftDate } from './agendaDateTime.js'

describe('business week helpers', () => {
    it('starts the week on Monday, also when the date is a Sunday', () => {
        expect(getWeekDays('2026-11-25')[0]).toBe('2026-11-23')
        expect(getWeekDays('2026-11-29')).toEqual([
            '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'
        ])
    })

    it('covers the whole week in Fortaleza time, crossing month boundaries', () => {
        expect(getWeekRange('2026-12-01')).toEqual({
            from: '2026-11-30T03:00:00.000Z',
            to: '2026-12-07T03:00:00.000Z'
        })
    })
})

describe('getLocalDateValue compatibility export', () => {
    it('matches the canonical Fortaleza date helper', () => {
        expect(getLocalDateValue()).toBe(fortalezaToday())
    })

    it('uses the Fortaleza calendar day for UTC timestamps', () => {
        expect(getLocalDateValue(new Date('2026-11-26T02:00:00Z'))).toBe('2026-11-25')
    })

    it('keeps shiftDate working with the alias', () => {
        expect(shiftDate('2026-11-25', 1)).toBe('2026-11-26')
    })
})
