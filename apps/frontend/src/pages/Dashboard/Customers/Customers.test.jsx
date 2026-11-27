// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/customersApi.js', () => ({
    listCustomers: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    getCustomerDetails: vi.fn()
}))

const { listCustomers } = await import('../../../services/customersApi.js')
const { default: Customers } = await import('./index.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let container

function deferred() {
    let resolve
    const promise = new Promise((res) => { resolve = res })
    return { promise, resolve }
}

function typeInto(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
})

afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe('Customers search', () => {
    it('ignora a resposta de uma busca antiga que chega depois da mais recente', async () => {
        const first = deferred()
        const second = deferred()
        listCustomers.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

        act(() => root.render(<Customers />))
        await act(async () => { vi.advanceTimersByTime(220) })
        expect(listCustomers).toHaveBeenLastCalledWith('')

        act(() => typeInto(container.querySelector('#customer-search'), 'bru'))
        await act(async () => { vi.advanceTimersByTime(220) })
        expect(listCustomers).toHaveBeenLastCalledWith('bru')

        await act(async () => { second.resolve([{ id: '2', name: 'Bruno', phone: '85 99999-0002' }]) })
        await act(async () => { first.resolve([{ id: '1', name: 'Ana', phone: '85 99999-0001' }]) })

        expect(container.textContent).toContain('Bruno')
        expect(container.textContent).not.toContain('Ana')
    })
})
