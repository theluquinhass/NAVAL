// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/schedulingApi.js', () => ({
    getPublicAvailability: vi.fn(),
    createAppointment: vi.fn()
}))

const { getPublicAvailability } = await import('../../services/schedulingApi.js')
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
        expect(await screen.findByRole('option', { name: /Corte degradê/ })).toBeTruthy()
        expect(getPublicAvailability).toHaveBeenCalledTimes(1)
        expect(getPublicAvailability.mock.calls[0][0]).toBe('tiago-barber')
        expect(getPublicAvailability.mock.calls[0][2]).toBe('')
        expect(screen.queryByRole('alert')).toBeNull()
        expect(screen.getByText('Escolha um serviço para ver os horários.')).toBeTruthy()
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
