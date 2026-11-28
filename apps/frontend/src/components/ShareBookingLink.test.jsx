// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeedbackProvider from './ui/FeedbackProvider.jsx'
import ShareBookingLink from './ShareBookingLink.jsx'
import { hasSharedBookingLink } from './shareBookingLinkState.js'

const writeText = vi.fn()

beforeEach(() => {
    window.localStorage.clear()
    writeText.mockReset()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
    delete navigator.clipboard
})

function renderShare(onShared = vi.fn()) {
    render(
        <FeedbackProvider>
            <ShareBookingLink slug="tiago-baber" barbershopName="Tiago Baber" onShared={onShared} />
        </FeedbackProvider>
    )
    return onShared
}

describe('ShareBookingLink', () => {
    it('shows the public booking URL and a WhatsApp message with it', () => {
        renderShare()

        const url = `${window.location.origin}/book/tiago-baber`
        expect(screen.getByLabelText('Link da sua barbearia').value).toBe(url)
        const whatsapp = screen.getByRole('link', { name: 'Enviar no WhatsApp' })
        expect(decodeURIComponent(whatsapp.getAttribute('href'))).toContain(url)
        expect(decodeURIComponent(whatsapp.getAttribute('href'))).toContain('Tiago Baber')
    })

    it('copies the link, remembers it was shared and confirms with a toast', async () => {
        writeText.mockResolvedValue()
        const onShared = renderShare()

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar link' })) })

        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/book/tiago-baber`)
        expect(onShared).toHaveBeenCalledTimes(1)
        expect(hasSharedBookingLink('tiago-baber')).toBe(true)
        expect(screen.getByRole('status').textContent).toContain('Link copiado')
    })

    it('explains what to do when the clipboard is blocked', async () => {
        writeText.mockRejectedValue(new Error('denied'))
        const onShared = renderShare()

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar link' })) })

        expect(onShared).not.toHaveBeenCalled()
        expect(screen.getByRole('status').textContent).toContain('copie manualmente')
    })
})
