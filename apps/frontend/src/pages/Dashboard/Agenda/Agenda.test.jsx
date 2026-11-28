// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ProfileContext } from '../../../contexts/profileContext.js'
import FeedbackProvider from '../../../components/ui/FeedbackProvider.jsx'
import { fortalezaToday } from '../../../utils/dashboard.js'
import { getWeekDays, getWeekRange } from './agendaDateTime.js'

vi.mock('../../../services/schedulingApi.js', () => ({
    getAppointments: vi.fn(),
    createPrivateAppointment: vi.fn(),
    getPublicAvailability: vi.fn()
}))
vi.mock('../../../services/servicesApi.js', () => ({
    listServices: vi.fn()
}))

const scheduling = await import('../../../services/schedulingApi.js')
const { listServices } = await import('../../../services/servicesApi.js')
const { default: Agenda } = await import('./index.jsx')

beforeAll(() => {
    // jsdom does not implement modal dialogs.
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true }
    HTMLDialogElement.prototype.close = function close() { this.open = false }
})

beforeEach(() => {
    scheduling.getAppointments.mockResolvedValue([])
    listServices.mockResolvedValue([{ id: 'svc-1', name: 'Corte', price: '40.00' }])
    scheduling.getPublicAvailability.mockResolvedValue({ slots: [] })
})

afterEach(() => {
    vi.clearAllMocks()
})

function renderAgenda(path = '/dashboard/agenda') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <FeedbackProvider>
                <ProfileContext.Provider value={{ profile: { slug: 'barbearia-teste' } }}>
                    <Agenda />
                </ProfileContext.Provider>
            </FeedbackProvider>
        </MemoryRouter>
    )
}

async function openDialog() {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /novo agendamento/i }))
    })
    return screen.findByLabelText('Nome do cliente')
}

describe('Agenda – novo agendamento', () => {
    it('abre o formulário limpo a cada abertura', async () => {
        renderAgenda()
        const name = await openDialog()
        fireEvent.change(name, { target: { value: 'Carlos' } })
        expect(name.value).toBe('Carlos')

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        const reopened = await openDialog()
        expect(reopened.value).toBe('')
    })

    it('fecha a modal e mostra sucesso depois de criar', async () => {
        scheduling.getPublicAvailability.mockResolvedValue({ slots: ['2099-01-01T13:00:00.000Z'] })
        scheduling.createPrivateAppointment.mockResolvedValue({})
        renderAgenda()
        await openDialog()

        fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Carlos' } })
        fireEvent.change(screen.getByLabelText('Telefone do cliente'), { target: { value: '85 99999-0000' } })
        await act(async () => {
            fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: 'svc-1' } })
        })
        const time = await screen.findByRole('option', { name: /10:00/ })
        fireEvent.change(screen.getByLabelText('Horário'), { target: { value: time.value } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Criar agendamento' }))
        })

        expect(scheduling.createPrivateAppointment).toHaveBeenCalledWith(expect.objectContaining({
            customerName: 'Carlos',
            serviceId: 'svc-1'
        }))
        expect(await screen.findByText('Agendamento criado com sucesso.')).toBeTruthy()
        expect(document.querySelector('dialog').open).toBe(false)
    })

    it('abre a modal direto quando vem do atalho do painel (?novo=1)', async () => {
        renderAgenda('/dashboard/agenda?novo=1')

        expect(await screen.findByLabelText('Nome do cliente')).toBeTruthy()
        expect(document.querySelector('dialog').open).toBe(true)
    })
})

describe('Agenda – visão semanal', () => {
    it('busca a semana inteira e agrupa os atendimentos por dia', async () => {
        const week = getWeekDays(fortalezaToday())
        scheduling.getAppointments.mockResolvedValue([
            { id: 'a1', customer_name: 'Ana', status: 'confirmed', starts_at: `${week[0]}T12:00:00.000Z`, ends_at: `${week[0]}T12:30:00.000Z` },
            { id: 'a2', customer_name: 'Bruno', status: 'cancelled', starts_at: `${week[2]}T18:00:00.000Z`, ends_at: `${week[2]}T18:30:00.000Z` }
        ])
        renderAgenda()
        await screen.findByText('Ana')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
        })

        expect(scheduling.getAppointments.mock.calls.at(-1)).toEqual([
            getWeekRange(fortalezaToday()).from,
            getWeekRange(fortalezaToday()).to
        ])
        expect(await screen.findByText('Bruno')).toBeTruthy()
        expect(screen.getByText('Ana')).toBeTruthy()
        expect(screen.getAllByText('Livre')).toHaveLength(5)
    })
})
