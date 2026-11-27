import { describe, expect, it } from 'vitest'
import {
    formatTimeInput,
    fortalezaInputValue,
    fortalezaToday,
    getErrorMessage,
    moneyToCents,
    periodBounds,
    toFortalezaIso
} from './dashboard.js'

describe('getErrorMessage', () => {
    it('usa mensagens amigáveis para sessão, busca e conflito', () => {
        expect(getErrorMessage({ response: { status: 401 } }, 'Fallback')).toMatch(/sessão expirou/i)
        expect(getErrorMessage({ response: { status: 404, data: { error: 'not_found' } } }, 'Fallback')).toMatch(/não encontramos/i)
        expect(getErrorMessage({ response: { status: 409, data: { error: 'duplicate' } } }, 'Fallback')).toMatch(/conflito/i)
    })

    it('respeita mensagens específicas por status e o fallback', () => {
        const error = { response: { status: 409, data: { error: 'SLOT_UNAVAILABLE' } } }
        expect(getErrorMessage(error, 'Fallback', { 409: 'Horário ocupado.' })).toBe('Horário ocupado.')
        expect(getErrorMessage(new Error('falha na rede'), 'Fallback')).toBe('falha na rede')
        expect(getErrorMessage({}, 'Fallback')).toBe('Fallback')
    })
})

describe('moneyToCents', () => {
    it('converte textos sem perder precisão de centavos', () => {
        expect(moneyToCents('10.99')).toBe(1099)
        expect(moneyToCents('0,1')).toBe(10)
        expect(moneyToCents('0.1') + moneyToCents('0.2')).toBe(30)
        expect(moneyToCents('')).toBe(0)
    })
})

describe('formatTimeInput', () => {
    it('normaliza horários digitados ou colados', () => {
        expect(formatTimeInput('9:00')).toBe('09:00')
        expect(formatTimeInput('09:00')).toBe('09:00')
        expect(formatTimeInput('0900')).toBe('09:00')
        expect(formatTimeInput('2:30')).toBe('02:30')
        expect(formatTimeInput('90:0')).toBe('09:00')
    })
})

describe('helpers de fuso', () => {
    it('converte instante e datetime-local para o horário de Fortaleza', () => {
        const instant = new Date('2026-11-25T12:00:00.000Z')
        expect(fortalezaInputValue(instant)).toBe('2026-11-25T09:00')
        expect(fortalezaToday(new Date('2026-11-25T02:00:00.000Z'))).toBe('2026-11-24')
        expect(toFortalezaIso('2026-11-25T09:00')).toBe('2026-11-25T09:00:00-03:00')
        expect(toFortalezaIso(instant.toISOString())).toBe('2026-11-25T09:00:00-03:00')
    })

    it('monta limites de período com dia final inclusivo', () => {
        const bounds = periodBounds('2026-11-01', '2026-11-30')
        expect(bounds.from).toBe('2026-11-01T00:00:00-03:00')
        expect(bounds.to).toBe('2026-12-01T00:00:00-03:00')
        expect(bounds.invalid).toBe(false)
        expect(periodBounds('2026-11-30', '2026-11-01').invalid).toBe(true)
    })
})
