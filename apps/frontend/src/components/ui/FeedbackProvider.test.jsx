// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FeedbackProvider from './FeedbackProvider.jsx'
import { useConfirm, useToast } from './feedbackContext.js'

function Harness({ options, onResult }) {
    const confirm = useConfirm()
    const notify = useToast()
    return (
        <>
            <button type="button" onClick={async () => onResult(await confirm(options))}>Abrir</button>
            <button type="button" onClick={() => notify('Serviço salvo.')}>Avisar</button>
        </>
    )
}

function renderHarness(options) {
    const results = []
    render(
        <FeedbackProvider>
            <Harness options={options} onResult={(value) => results.push(value)} />
        </FeedbackProvider>
    )
    return results
}

describe('FeedbackProvider', () => {
    it('resolves true when the user confirms and focuses the safe choice first', async () => {
        const results = renderHarness({ title: 'Excluir "Corte"?', confirmLabel: 'Excluir', tone: 'danger' })

        fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
        const dialog = screen.getByRole('alertdialog', { name: 'Excluir "Corte"?' })
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }))

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Excluir' })) })

        expect(results).toEqual([true])
        expect(dialog.isConnected).toBe(false)
    })

    it('resolves false when the user presses Escape', async () => {
        const results = renderHarness({ title: 'Excluir?' })

        fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
        await act(async () => { fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' }) })

        expect(results).toEqual([false])
        expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('returns the typed text in prompt mode and blocks an empty value', async () => {
        const results = renderHarness({
            title: 'Devolver venda?',
            input: { label: 'Motivo da devolução', defaultValue: '' },
            confirmLabel: 'Estornar'
        })

        fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
        const confirmButton = screen.getByRole('button', { name: 'Estornar' })
        expect(confirmButton.disabled).toBe(true)

        fireEvent.change(screen.getByLabelText('Motivo da devolução'), { target: { value: '  Produto com defeito ' } })
        await act(async () => { fireEvent.click(confirmButton) })

        expect(results).toEqual(['Produto com defeito'])
    })

    it('announces toasts in a polite live region', () => {
        renderHarness({ title: 'x' })

        fireEvent.click(screen.getByRole('button', { name: 'Avisar' }))

        expect(screen.getByRole('status').textContent).toContain('Serviço salvo.')
    })
})
