import { expect, test } from '@playwright/test'

const SERVICE = { id: '8d8c9f3a-59f0-4d8c-9f0a-112233445566', name: 'Corte degradê', description: 'Máquina e tesoura', price: 35, duration: 30 }

async function mockBookingApi(page, { bookingStatus = 201 } = {}) {
    const requests = { availability: [], appointments: [] }

    await page.route('**/api/booking/*/availability**', async (route) => {
        const url = new URL(route.request().url())
        requests.availability.push(Object.fromEntries(url.searchParams))
        const date = url.searchParams.get('date')
        const hasService = url.searchParams.has('serviceId')
        await route.fulfill({
            json: {
                barbershop: { id: 'shop-1', name: 'Barbearia do Zé', slug: 'barbearia-do-ze' },
                services: [SERVICE],
                // 13:00Z and 19:00Z are 10:00 and 16:00 in Fortaleza.
                slots: hasService ? [`${date}T13:00:00.000Z`, `${date}T19:00:00.000Z`] : []
            }
        })
    })

    await page.route('**/api/booking/*/appointments', async (route) => {
        requests.appointments.push(route.request().postDataJSON())
        if (bookingStatus === 201) {
            await route.fulfill({ status: 201, json: { appointment: { id: 'appointment-1' } } })
        } else {
            await route.fulfill({ status: bookingStatus, json: { error: 'Esse horário não está mais disponível.', code: 'SLOT_TAKEN' } })
        }
    })

    return requests
}

test('cliente agenda um horário pela página pública', async ({ page }) => {
    const requests = await mockBookingApi(page)

    await page.goto('/book/barbearia-do-ze')
    await expect(page.getByRole('heading', { level: 1, name: 'Barbearia do Zé' })).toBeVisible()
    expect(requests.availability[0]).not.toHaveProperty('serviceId')

    await page.getByRole('radio', { name: /Corte degradê/ }).check()
    await page.getByRole('group', { name: 'Próximos dias' }).getByRole('button').nth(1).click()
    await page.getByRole('button', { name: '16:00' }).click()

    await page.getByLabel('Seu nome').fill('Ana Souza')
    await page.getByLabel('Telefone (WhatsApp)').fill('(84) 99999-1234')
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click()

    await expect(page.getByRole('heading', { name: 'Agendamento confirmado!' })).toBeVisible()
    expect(requests.appointments).toHaveLength(1)
    expect(requests.appointments[0]).toMatchObject({ customerName: 'Ana Souza', serviceId: SERVICE.id })
    expect(requests.appointments[0].startsAt).toMatch(/T19:00:00\.000Z$/)
})

test('cliente é avisado quando o horário acabou de ser ocupado', async ({ page }) => {
    await mockBookingApi(page, { bookingStatus: 409 })

    await page.goto('/book/barbearia-do-ze')
    await page.getByRole('radio', { name: /Corte degradê/ }).check()
    await page.getByRole('button', { name: '10:00' }).click()
    await page.getByLabel('Seu nome').fill('Ana Souza')
    await page.getByLabel('Telefone (WhatsApp)').fill('(84) 99999-1234')
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click()

    await expect(page.getByRole('alert')).toContainText('Escolha outro horário')
})

test('página da barbearia inexistente explica o problema', async ({ page }) => {
    await page.route('**/api/booking/*/availability**', (route) => route.fulfill({
        status: 404,
        json: { error: 'Barbearia ou serviço não encontrado.', code: 'BARBERSHOP_NOT_FOUND' }
    }))

    await page.goto('/book/nao-existe')

    await expect(page.getByRole('alert')).toContainText('Não encontramos esta barbearia')
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible()
})
