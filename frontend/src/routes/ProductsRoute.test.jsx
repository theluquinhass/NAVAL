// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { ProfileContext } from '../contexts/profileContext.js'
import ProductsRoute from './ProductsRoute.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let container

function render(ui) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(ui))
    return container
}

function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}</span>
}

afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
    root = null
    container = null
})

describe('ProductsRoute', () => {
    it('redireciona quando sellsProducts é falso', () => {
        const screen = render(
            <MemoryRouter initialEntries={['/dashboard/products']}>
                <ProfileContext.Provider value={{ profile: { sellsProducts: false } }}>
                    <Routes>
                        <Route path="/dashboard/products" element={<ProductsRoute><p>Área de produtos</p></ProductsRoute>} />
                        <Route path="/dashboard" element={<LocationProbe />} />
                    </Routes>
                </ProfileContext.Provider>
            </MemoryRouter>
        )

        expect(screen.querySelector('[data-testid="location"]')?.textContent).toBe('/dashboard')
        expect(screen.textContent).not.toContain('Área de produtos')
    })

    it('mantém a página quando sellsProducts é verdadeiro', () => {
        const screen = render(
            <MemoryRouter initialEntries={['/dashboard/products']}>
                <ProfileContext.Provider value={{ profile: { sellsProducts: true } }}>
                    <Routes>
                        <Route path="/dashboard/products" element={<ProductsRoute><p>Área de produtos</p></ProductsRoute>} />
                        <Route path="/dashboard" element={<LocationProbe />} />
                    </Routes>
                </ProfileContext.Provider>
            </MemoryRouter>
        )

        expect(screen.textContent).toContain('Área de produtos')
        expect(screen.querySelector('[data-testid="location"]')).toBeNull()
    })
})
