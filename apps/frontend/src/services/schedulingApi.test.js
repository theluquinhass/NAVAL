import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api.js', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const { default: api } = await import('./api.js')
const { getPublicAvailability } = await import('./schedulingApi.js')

describe('getPublicAvailability', () => {
    beforeEach(() => {
        api.get.mockReset()
        api.get.mockResolvedValue({ data: { services: [], slots: [] } })
    })

    it('omits serviceId when no service is selected yet', async () => {
        await getPublicAvailability('tiago-barber', '2026-11-28', '')

        expect(api.get).toHaveBeenCalledWith(
            '/booking/tiago-barber/availability',
            { params: { date: '2026-11-28' }, skipAuth: true }
        )
    })

    it('sends serviceId when a service is selected', async () => {
        const serviceId = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'

        await getPublicAvailability('tiago-barber', '2026-11-28', serviceId)

        expect(api.get).toHaveBeenCalledWith(
            '/booking/tiago-barber/availability',
            { params: { date: '2026-11-28', serviceId }, skipAuth: true }
        )
    })
})
