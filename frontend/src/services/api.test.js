import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            signOut: vi.fn()
        }
    }
}))

const { supabase } = await import('../lib/supabase')
const { default: api } = await import('./api.js')

function failWith(status) {
    api.defaults.adapter = async (config) => {
        const error = new Error(`HTTP ${status}`)
        error.config = config
        error.response = { status, config, data: {} }
        throw error
    }
}

beforeEach(() => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    supabase.auth.signOut.mockResolvedValue({ error: null })
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('api 401 handling', () => {
    it('encerra a sessão local quando uma requisição autenticada recebe 401', async () => {
        failWith(401)
        await expect(api.get('/profile')).rejects.toThrow('HTTP 401')
        expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    })

    it('não encerra a sessão em outros erros', async () => {
        failWith(500)
        await expect(api.get('/profile')).rejects.toThrow('HTTP 500')
        expect(supabase.auth.signOut).not.toHaveBeenCalled()
    })

    it('não encerra a sessão quando a requisição pública (skipAuth) recebe 401', async () => {
        failWith(401)
        await expect(api.get('/public', { skipAuth: true })).rejects.toThrow('HTTP 401')
        expect(supabase.auth.signOut).not.toHaveBeenCalled()
    })
})
