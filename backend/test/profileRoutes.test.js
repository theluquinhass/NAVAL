import { after, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const calls = []
let operation
let lookupResult
let updateResult

const lookupQuery = {
    select(columns) {
        calls.push(['lookup:select', columns])
        return this
    },
    eq(column, value) {
        calls.push(['lookup:eq', column, value])
        return this
    },
    maybeSingle() {
        calls.push(['lookup:maybeSingle'])
        return Promise.resolve(lookupResult)
    }
}

const updateQuery = {
    update(values) {
        calls.push(['update', values])
        return this
    },
    eq(column, value) {
        calls.push(['update:eq', column, value])
        return this
    },
    select(columns) {
        calls.push(['update:select', columns])
        return this
    },
    maybeSingle() {
        operation = 'lookup'
        return Promise.resolve(updateResult)
    }
}

const client = {
    from(table) {
        calls.push(['from', table])
        if (table !== 'barbershops') throw new Error(`unexpected table: ${table}`)
        if (operation === 'update') return updateQuery
        operation = 'update'
        return lookupQuery
    }
}

mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: {
            auth: {
                async getUser() {
                    return { data: { user: { id: 'user-1' } }, error: null }
                }
            }
        },
        createUserClient: () => client,
        createPublicClient: () => ({})
    }
})

function makeToken(subject = 'user-1') {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
    return `${encode({ alg: 'RS256' })}.${encode({ sub: subject, exp: Math.floor(Date.now() / 1000) + 3600 })}.fabricated-signature`
}

let server
let baseUrl
let clearAuthCache
let clearProfileCache

before(async () => {
    ;({ clearAuthCache } = await import('../src/middlewares/authCache.js'))
    ;({ clearProfileCache } = await import('../src/services/barbershopService.js'))
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
    calls.length = 0
    operation = 'lookup'
    clearAuthCache()
    clearProfileCache()
    lookupResult = { data: { id: 'shop-1' }, error: null }
    updateResult = {
        data: { id: 'shop-1', name: 'NAVAL', barberName: 'Lucas Caetano', slug: 'naval', phone: '(85) 99999-1234' },
        error: null
    }
}

async function request(method, body, token = makeToken()) {
    return fetch(`${baseUrl}/profile`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    })
}

const validBody = { barberName: 'Lucas Caetano', name: 'NAVAL', phone: '(85) 99999-1234', slug: 'NAVAL 24h' }

test('rejects an unauthenticated profile update', async () => {
    reset()

    const response = await request('PUT', validBody, null)

    assert.equal(response.status, 401)
    assert.equal(calls.length, 0)
})

test('rejects an invalid profile update payload', async () => {
    reset()

    const response = await request('PUT', { name: ' ', phone: '123', slug: 'naval' })

    assert.equal(response.status, 400)
    assert.equal(calls.length, 0)
})

test('updates the profile with a normalized slug and returns the phone', async () => {
    reset()

    const response = await request('PUT', validBody)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body.profile, updateResult.data)
    assert.deepEqual(calls.find(([name]) => name === 'update')[1], {
        barber_name: 'Lucas Caetano',
        name: 'NAVAL',
        phone: '(85) 99999-1234',
        slug: 'naval-24h'
    })
    assert.deepEqual(calls.filter(([name]) => name === 'update:eq'), [
        ['update:eq', 'id', 'shop-1'],
        ['update:eq', 'user_id', 'user-1']
    ])
})

test('maps a duplicate slug to a friendly conflict', async () => {
    reset()
    updateResult = { data: null, error: { code: '23505', message: 'duplicate key' } }

    const response = await request('PUT', validBody)
    const body = await response.json()

    assert.equal(response.status, 409)
    assert.match(body.error, /endereço/i)
})

test('returns 404 when the authenticated user has no profile', async () => {
    reset()
    lookupResult = { data: null, error: null }

    const response = await request('PUT', validBody)

    assert.equal(response.status, 404)
    assert.equal(calls.some(([name]) => name === 'update'), false)
})

test('includes the phone when reading the profile', async () => {
    reset()
    lookupResult = {
        data: { id: 'shop-1', name: 'NAVAL', barberName: 'Lucas Caetano', slug: 'naval', phone: '(85) 99999-1234' },
        error: null
    }

    const response = await request('GET')
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body.profile, lookupResult.data)
    assert.equal(calls.find(([name]) => name === 'lookup:select')[1], 'id, name, barberName:barber_name, slug, phone')
})
