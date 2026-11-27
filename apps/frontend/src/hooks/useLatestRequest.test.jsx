// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLatestRequest } from './useLatestRequest.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('useLatestRequest', () => {
    it('só considera atual a requisição mais recente', () => {
        const { result, unmount } = renderHook(() => useLatestRequest())
        const first = result.current()
        expect(first()).toBe(true)

        const second = result.current()
        expect(first()).toBe(false)
        expect(second()).toBe(true)
        unmount()
    })

    it('invalida requisições depois que o componente desmonta', () => {
        const { result, unmount } = renderHook(() => useLatestRequest())
        const pending = result.current()
        unmount()
        expect(pending()).toBe(false)
    })
})
