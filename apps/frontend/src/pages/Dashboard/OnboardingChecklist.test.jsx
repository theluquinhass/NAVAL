// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/servicesApi.js', () => ({ listServices: vi.fn() }))
vi.mock('../../services/schedulingApi.js', () => ({ getWorkingHours: vi.fn() }))

const { listServices } = await import('../../services/servicesApi.js')
const { getWorkingHours } = await import('../../services/schedulingApi.js')
const { default: OnboardingChecklist } = await import('./OnboardingChecklist.jsx')

function renderChecklist(props = {}) {
    return render(<MemoryRouter><OnboardingChecklist linkShared={false} {...props} /></MemoryRouter>)
}

afterEach(() => vi.clearAllMocks())

describe('OnboardingChecklist', () => {
    it('guides a new owner to register services first', async () => {
        listServices.mockResolvedValue([])
        getWorkingHours.mockResolvedValue([])

        renderChecklist()

        expect(await screen.findByRole('heading', { name: /pronta para receber agendamentos/i })).toBeTruthy()
        expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1')
        const next = screen.getByRole('link', { name: 'Cadastrar serviços' })
        expect(next.getAttribute('href')).toBe('/dashboard/services')
        expect(next.className).toContain('ui-button--primary')
        expect(screen.getByRole('link', { name: 'Definir horários' }).className).toContain('ui-button--secondary')
    })

    it('points to the share link once services and hours exist', async () => {
        listServices.mockResolvedValue([{ id: 's1' }])
        getWorkingHours.mockResolvedValue([{ day_of_week: 1 }])

        renderChecklist()

        const share = await screen.findByRole('link', { name: 'Ver link' })
        expect(share.getAttribute('href')).toBe('#share-link-title')
        expect(screen.queryByRole('link', { name: 'Cadastrar serviços' })).toBeNull()
    })

    it('disappears when every step is done', async () => {
        listServices.mockResolvedValue([{ id: 's1' }])
        getWorkingHours.mockResolvedValue([{ day_of_week: 1 }])

        const { container } = renderChecklist({ linkShared: true })

        await vi.waitFor(() => expect(listServices).toHaveBeenCalled())
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(container.querySelector('.onboarding')).toBeNull()
    })

    it('tells the owner when the steps cannot be checked', async () => {
        listServices.mockRejectedValue(new Error('offline'))
        getWorkingHours.mockResolvedValue([])

        renderChecklist()

        expect(await screen.findByText('Não foi possível verificar seus primeiros passos agora.')).toBeTruthy()
    })
})
