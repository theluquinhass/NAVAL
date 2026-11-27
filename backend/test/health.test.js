import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: { auth: { getUser: async () => ({ data: { user: null }, error: new Error('unused') }) } },
        createUserClient: () => ({}),
        createPublicClient: () => ({})
    }
})

let server
let baseUrl

before(async () => {
    const { default: app } = await import('../src/app.js')
    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => new Promise((resolve) => server.close(resolve)))

test('GET /health responde 200 sem autenticação', async () => {
    const response = await fetch(`${baseUrl}/health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })
})
