import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clearProfileCache, getBarbershopIdForAuthenticatedUser, updateProfileForUser } from '../src/services/barbershopService.js'

const calls = []
let phase
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
        phase = 'lookup'
        return Promise.resolve(updateResult)
    }
}

const supabase = {
    from(table) {
        calls.push(['from', table])
        if (table !== 'barbershops') throw new Error(`unexpected table: ${table}`)
        if (phase === 'lookup') {
            phase = 'update'
            return lookupQuery
        }
        return updateQuery
    }
}

const payload = { barberName: 'Lucas Caetano', name: 'NAVAL', phone: '(85) 99999-1234', slug: 'naval', sellsProducts: true }

function reset() {
    calls.length = 0
    phase = 'lookup'
    clearProfileCache()
    lookupResult = { data: { id: 'shop-1' }, error: null }
    updateResult = {
        data: { id: 'shop-1', name: payload.name, barberName: payload.barberName, phone: payload.phone, slug: payload.slug },
        error: null
    }
}

test('updates only the authenticated user profile and invalidates the cached id', async () => {
    reset()

    const updated = await updateProfileForUser(supabase, 'user-1', payload)

    assert.deepEqual(updated, updateResult.data)
    assert.deepEqual(calls.filter(([name]) => name === 'from'), [
        ['from', 'barbershops'],
        ['from', 'barbershops']
    ])
    assert.deepEqual(calls.find(([name]) => name === 'update')[1], {
        barber_name: payload.barberName,
        name: payload.name,
        phone: payload.phone,
        slug: payload.slug,
        sells_products: payload.sellsProducts
    })
    assert.deepEqual(calls.filter(([name]) => name === 'update:eq'), [
        ['update:eq', 'id', 'shop-1'],
        ['update:eq', 'user_id', 'user-1']
    ])
    assert.equal(calls.find(([name]) => name === 'update:select')[1], 'id, name, barberName:barber_name, slug, phone, sellsProducts:sells_products')

    calls.length = 0
    await getBarbershopIdForAuthenticatedUser(supabase, 'user-1')
    assert.equal(calls.filter(([name]) => name === 'lookup:maybeSingle').length, 1)
})

test('preserves the database cause when the slug is duplicated', async () => {
    reset()
    const duplicateError = { code: '23505', message: 'duplicate key value violates unique constraint' }
    updateResult = { data: null, error: duplicateError }

    await assert.rejects(updateProfileForUser(supabase, 'user-1', payload), (error) => {
        assert.equal(error.message, 'PROFILE_UPDATE_FAILED')
        assert.equal(error.cause, duplicateError)
        return true
    })
})

test('rejects when no profile belongs to the authenticated user', async () => {
    reset()
    lookupResult = { data: null, error: null }

    await assert.rejects(updateProfileForUser(supabase, 'user-1', payload), { message: 'BARBERSHOP_NOT_FOUND' })
    assert.equal(calls.some(([name]) => name === 'update'), false)
})

test('rejects when the update query fails', async () => {
    reset()
    const queryError = { code: '42501', message: 'update denied' }
    updateResult = { data: null, error: queryError }

    await assert.rejects(updateProfileForUser(supabase, 'user-1', payload), (error) => {
        assert.equal(error.message, 'PROFILE_UPDATE_FAILED')
        assert.equal(error.cause, queryError)
        return true
    })
})
