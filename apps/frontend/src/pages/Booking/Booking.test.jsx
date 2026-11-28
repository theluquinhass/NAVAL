// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/schedulingApi.js', () => ({
    getPublicAvailability: vi.fn(),
    createAppointment: vi.fn()
}))

const { getPublicAvailability, createAppointment } = await import('../../services/schedulingApi.js')
const { default: Booking } = await import('./index.jsx')

const SERVICE = {
    id: '8d8c9f3a-59f0-4d8c-9f0a-112233445566',
    name: 'Corte degradê',
    price: '35.00',
    duration: 30
}

function renderBooking() {
    return render(
        <MemoryRouter initialEntries={['/book/tiago-barber']}>
            <Routes>
                <Route path="/book/:slug" element={<Booking />} />
            </Routes>
        </MemoryRouter>
    )
}

afterEach(() => {
    vi.clearAllMocks()
})

describe('Booking page', () => {
    it('loads the service catalog on first render without a serviceId', async () => {
        getPublicAvailability.mockResolvedValue({
            barbershop: { name: 'Barbearia do Tiago' },
            services: [SERVICE],
            slots: []
        })

        renderBooking()

        expect(screen.getByText('Buscando horários...')).toBeTruthy()
        expect(await screen.findByRole('radio', { name: /Corte degradê/ })).toBeTruthy()
        expect(getPublicAvailability).toHaveBeenCalledTimes(1)
        expect(getPublicAvailability.mock.calls[0][0]).toBe('tiago-barber')
        expect(getPublicAvailability.mock.calls[0][2]).toBe('')
        expect(screen.queryByRole('alert')).toBeNull()
        expect(screen.getByText('Escolha um serviço para ver os horários.')).toBeTruthy()
    })

    it('books a slot end to end: service, time, customer data and confirmation', async () => {
        const slot = '2026-12-01T13:30:00.000Z'
        getPublicAvailability.mockImplementation(async (_slug, _date, serviceId) => ({
            barbershop: { name: 'Barbearia do Tiago' },
            services: [SERVICE],
            slots: serviceId ? [slot] : []
        }))
        createAppointment.mockResolvedValue({ id: 'appointment-1' })

        renderBooking()

        fireEvent.click(await screen.findByRole('radio', { name: /Corte degradê/ }))
        fireEvent.click(await screen.findByRole('button', { name: '10:30' }))
        fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana Souza' } })
        fireEvent.change(screen.getByLabelText('Telefone (WhatsApp)'), { target: { value: '(84) 99999-1234' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }))

        expect(await screen.findByRole('heading', { name: 'Agendamento confirmado!' })).toBeTruthy()
        expect(createAppointment).toHaveBeenCalledWith('tiago-barber', {
            customerName: 'Ana Souza',
            customerPhone: '(84) 99999-1234',
            serviceId: SERVICE.id,
            startsAt: slot
        })
    })

    it('asks for another time when the slot was taken in the meantime', async () => {
        const slot = '2026-12-01T13:30:00.000Z'
        getPublicAvailability.mockImplementation(async (_slug, _date, serviceId) => ({
            barbershop: { name: 'Barbearia do Tiago' },
            services: [SERVICE],
            slots: serviceId ? [slot] : []
        }))
        createAppointment.mockRejectedValue({ response: { status: 409, data: { error: 'x' } } })

        renderBooking()

        fireEvent.click(await screen.findByRole('radio', { name: /Corte degradê/ }))
        fireEvent.click(await screen.findByRole('button', { name: '10:30' }))
        fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana Souza' } })
        fireEvent.change(screen.getByLabelText('Telefone (WhatsApp)'), { target: { value: '(84) 99999-1234' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }))

        expect((await screen.findByRole('alert')).textContent).toContain('Escolha outro horário')
        expect(screen.getByRole('button', { name: 'Confirmar agendamento' }).disabled).toBe(true)
    })

    it('shows the API error when the catalog cannot be loaded', async () => {
        getPublicAvailability.mockRejectedValue({
            response: { status: 404, data: { error: 'Barbearia ou serviço não encontrado.' } }
        })

        renderBooking()

        expect(await screen.findByRole('alert')).toBeTruthy()
        expect(screen.queryByText('Buscando horários...')).toBeNull()
    })
})
