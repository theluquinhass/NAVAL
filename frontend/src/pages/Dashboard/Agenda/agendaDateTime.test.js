import { describe, expect, it } from 'vitest'
import { fortalezaToday } from '../../../utils/dashboard.js'
import { getLocalDateValue, shiftDate } from './agendaDateTime.js'

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
