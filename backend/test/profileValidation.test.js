import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSlug, validateProfilePayload, validateProfileUpdatePayload } from '../src/validation/profileValidation.js'

test('normalizes accents, spaces and symbols into a URL slug', () => {
    assert.equal(normalizeSlug(' Barbearia do Zé '), 'barbearia-do-ze')
    assert.equal(normalizeSlug('NAVAL/// 24h'), 'naval-24h')
    assert.equal(normalizeSlug('---'), '')
})

test('accepts a valid profile payload', () => {
    const result = validateProfilePayload({
        barberName: '  Lucas Caetano  ',
        name: '  NAVAL  ',
        phone: ' (85) 99999-1234 ',
        slug: ' Barbearia do Zé ',
        sellsProducts: true
    })

    assert.deepEqual(result, {
        payload: {
            barberName: 'Lucas Caetano',
            name: 'NAVAL',
            phone: '(85) 99999-1234',
            slug: 'barbearia-do-ze',
            sellsProducts: true
        }
    })
})

test('hides products by default when the selling option is omitted', () => {
    const result = validateProfilePayload({
        barberName: 'Lucas',
        name: 'NAVAL',
        phone: '123',
        slug: 'naval'
    })

    assert.equal(result.payload.sellsProducts, false)
    assert.match(validateProfilePayload({
        barberName: 'Lucas',
        name: 'NAVAL',
        phone: '123',
        slug: 'naval',
        sellsProducts: 'sim'
    }).error, /produtos/i)
})

test('keeps the update validator compatible', () => {
    const result = validateProfileUpdatePayload({
        barberName: 'Lucas',
        name: 'NAVAL',
        phone: '123',
        slug: 'naval'
    })

    assert.equal(result.error, undefined)
    assert.equal(result.payload.barberName, 'Lucas')
})

test('rejects empty barber names, barbershop names and phones', () => {
    assert.match(validateProfilePayload({ barberName: ' ', name: 'NAVAL', phone: '123', slug: 'naval' }).error, /barbeiro/i)
    assert.match(validateProfilePayload({ barberName: 'Lucas', name: ' ', phone: '123', slug: 'naval' }).error, /barbearia/i)
    assert.match(validateProfilePayload({ barberName: 'Lucas', name: 'NAVAL', phone: '', slug: 'naval' }).error, /telefone/i)
})

test('rejects malformed slugs', () => {
    assert.match(validateProfilePayload({ barberName: 'Lucas', name: 'NAVAL', phone: '123', slug: '---' }).error, /endereço/i)
    assert.match(validateProfilePayload({ barberName: 'Lucas', name: 'NAVAL', phone: '123', slug: 'a'.repeat(81) }).error, /endereço/i)
})

test('rejects non-object payloads', () => {
    assert.match(validateProfilePayload(null).error, /inválidos/i)
    assert.match(validateProfilePayload([]).error, /inválidos/i)
})
