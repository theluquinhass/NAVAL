import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const getUserCalls = []
const profileQueries = []
let now = Date.now()

let getUserResult
let clearAuthCache

const profileQuery = {
    select() {
        return this
    },
    eq() {
        return this
    },
    maybeSingle() {
        return Promise.resolve({ data: { id: 'shop-1', name: 'Barbearia', slug: 'barbearia' }, error: null })
    }
}

mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: {
            auth: {
                async getUser(token) {
                    getUserCalls.push(token)
                    return getUserResult(token)
                }
            }
        },
        createUserClient: () => ({
            from(table) {
                if (table !== 'barbershops') throw new Error(`unexpected table: ${table}`)
                profileQueries.push(table)
                return profileQuery
            }
        }),
        createPublicClient: () => ({})
    }
})

function makeToken(expiresAtSeconds, subject = 'test-user') {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
    return `${encode({ alg: 'RS256' })}.${encode({ sub: subject, exp: expiresAtSeconds })}.fabricated-signature`
}

let server
let baseUrl
before(async () => {
    ;({ clearAuthCache } = await import('../src/middlewares/authCache.js'))
    const { default: app } = await import('../src/app.js')
    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    mock.restoreAll()
})

function reset() {
    getUserCalls.length = 0
    profileQueries.length = 0
    clearAuthCache()
    getUserResult = () => ({ data: { user: { id: 'user-1' } }, error: null })
}

async function request(token) {
    return fetch(`${baseUrl}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
    })
}

test('reuses one successful auth lookup for repeated requests', async () => {
    reset()
    const token = makeToken(Math.floor(now / 1000) + 3600)

    const first = await request(token)
    const second = await request(token)

    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(getUserCalls.length, 1)
    assert.match(first.headers.get('server-timing'), /auth;dur=\d+\.\d/)
    assert.match(first.headers.get('server-timing'), /total;dur=\d+\.\d/)
})

test('does not share cached auth across different tokens', async () => {
    reset()
    await request(makeToken(Math.floor(now / 1000) + 3600, 'user-1'))
    await request(makeToken(Math.floor(now / 1000) + 3600, 'user-2'))

    assert.equal(getUserCalls.length, 2)
})

test('rejects an already expired JWT without calling the auth provider', async () => {
    reset()
    const token = makeToken(Math.floor(now / 1000) - 10)

    const first = await request(token)
    const second = await request(token)

    assert.equal(first.status, 401)
    assert.equal(second.status, 401)
    assert.equal(getUserCalls.length, 0)
})

test('expires the cached auth entry after the TTL', async () => {
    reset()
    const token = makeToken(Math.floor(now / 1000) + 3600)
    const nowMock = mock.method(Date, 'now', () => now)

    try {
        await request(token)
        now += 31_000
        await request(token)
    } finally {
        nowMock.mock.restore()
    }

    assert.equal(getUserCalls.length, 2)
})
