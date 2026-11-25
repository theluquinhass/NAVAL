import { after, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const lookups = []
let now = 1_800_000_000_000

const query = {
    select() {
        return this
    },
    eq(column, value) {
        lookups.push([column, value])
        return this
    },
    maybeSingle() {
        return Promise.resolve({ data: { id: 'shop-1' }, error: null })
    }
}

const supabase = {
    from(table) {
        if (table !== 'barbershops') throw new Error(`unexpected table: ${table}`)
        return query
    }
}

mock.module('../src/config/supabase.js', {
    namedExports: {
        supabase: {},
        createUserClient: () => supabase,
        createPublicClient: () => ({})
    }
})

let getBarbershopIdForAuthenticatedUser
let clearProfileCache

const { barbershopService } = await import('../src/services/barbershopService.js').then((module) => ({ barbershopService: module }))
getBarbershopIdForAuthenticatedUser = barbershopService.getBarbershopIdForAuthenticatedUser
clearProfileCache = barbershopService.clearProfileCache

after(() => mock.restoreAll())

function reset() {
    lookups.length = 0
    clearProfileCache()
}

test('resolves the barbershop id once per user while the cache is fresh', async () => {
    reset()

    assert.equal(await getBarbershopIdForAuthenticatedUser(supabase, 'user-1'), 'shop-1')
    assert.equal(await getBarbershopIdForAuthenticatedUser(supabase, 'user-1'), 'shop-1')
    assert.deepEqual(lookups, [['user_id', 'user-1']])
})

test('keeps separate entries for separate users', async () => {
    reset()

    await getBarbershopIdForAuthenticatedUser(supabase, 'user-1')
    await getBarbershopIdForAuthenticatedUser(supabase, 'user-2')

    assert.deepEqual(lookups, [['user_id', 'user-1'], ['user_id', 'user-2']])
})

test('expires the cached barbershop id after the TTL', async () => {
    reset()
    const nowMock = mock.method(Date, 'now', () => now)

    try {
        await getBarbershopIdForAuthenticatedUser(supabase, 'user-1')
        now += 31_000
        await getBarbershopIdForAuthenticatedUser(supabase, 'user-1')
    } finally {
        nowMock.mock.restore()
    }

    assert.equal(lookups.length, 2)
})
