// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/schedulingApi.js', () => ({
    getWorkingHours: vi.fn(),
    saveWorkingHours: vi.fn()
}))

const { getWorkingHours, saveWorkingHours } = await import('../../../services/schedulingApi.js')
const { default: WorkingHours } = await import('./index.jsx')

beforeEach(() => {
    getWorkingHours.mockResolvedValue([])
    saveWorkingHours.mockImplementation(async (hours) => hours)
})

afterEach(() => {
    vi.clearAllMocks()
})

async function renderPage() {
    render(<WorkingHours />)
    return screen.findByLabelText('Atende neste dia', { selector: '#working-day-1' })
}

async function openMondayNineToSix() {
    const monday = await renderPage()
    fireEvent.click(monday)
    fireEvent.change(screen.getByLabelText('Segunda-feira, período 1, horário de início'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('Segunda-feira, período 1, horário de término'), { target: { value: '18:00' } })
}

describe('WorkingHours', () => {
    it('copia a segunda para seg–sex e salva a grade semanal', async () => {
        await openMondayNineToSix()
        fireEvent.click(screen.getByRole('button', { name: 'Copiar horário de Segunda-feira para segunda a sexta' }))

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Salvar horários' }))
        })

        const [hours, options] = saveWorkingHours.mock.calls[0]
        expect(options).toEqual({ confirmConflicts: false })
        expect(hours.map((h) => h.day_of_week)).toEqual([1, 2, 3, 4, 5])
        expect(hours.every((h) => h.opens_at === '09:00' && h.closes_at === '18:00' && h.period_index === 0)).toBe(true)
        expect(await screen.findByText('Horários salvos com sucesso.')).toBeTruthy()
    })

    it('mostra conflitos e reenvia com confirmação', async () => {
        saveWorkingHours.mockRejectedValueOnce({
            response: {
                status: 409,
                data: {
                    code: 'WORKING_HOURS_CONFLICTS',
                    conflicts: [{ id: 'a1', customer_name: 'Carlos', starts_at: '2099-01-05T13:00:00Z' }],
                    totalConflicts: 1
                }
            }
        })
        await openMondayNineToSix()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Salvar horários' }))
        })
        expect(await screen.findByText('Revise os agendamentos afetados')).toBeTruthy()
        expect(screen.getByText('Carlos')).toBeTruthy()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Salvar e manter agendamentos' }))
        })
        expect(saveWorkingHours).toHaveBeenLastCalledWith(expect.any(Array), { confirmConflicts: true })
        expect(screen.queryByText('Revise os agendamentos afetados')).toBeNull()
    })
})
