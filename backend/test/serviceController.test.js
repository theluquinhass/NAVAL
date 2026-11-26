import { after, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const ID = '8d8c9f3a-59f0-4d8c-9f0a-112233445566'
const calls = []

mock.module('../src/services/Services.js', {
    namedExports: {
        listServices: (...args) => record('listServices', args),
        createService: (...args) => record('createService', args),
        updateService: (...args) => record('updateService', args),
        deleteService: (...args) => record('deleteService', args)
    }
})

function record(name, args) {
    calls.push({ name, args })
    return {}
}

function fakeResponse() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(body) {
            this.body = body
            return this
        },
        send() {
            return this
        }
    }
}

after(() => mock.restoreAll())

const { default: controller } = await import('../src/controllers/serviceController.js')

test('rejects invalid ids on update before calling the service', async () => {
    calls.length = 0
    const res = fakeResponse()

    await controller.updateService({
        params: { id: 'not-a-uuid' },
        body: { name: 'Corte', price: 25.5, duration: 30 }
    }, res)

    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body, { error: 'Identificador inválido.', code: 'INVALID_ID' })
    assert.equal(calls.length, 0)
})

test('rejects invalid ids on delete before calling the service', async () => {
    calls.length = 0
    const res = fakeResponse()

    await controller.deleteService({ params: { id: 'not-a-uuid' } }, res)

    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body, { error: 'Identificador inválido.', code: 'INVALID_ID' })
    assert.equal(calls.length, 0)
})

test('passes valid ids through to the service', async () => {
    calls.length = 0
    const res = fakeResponse()

    await controller.deleteService({
        params: { id: ID },
        accessToken: 'token-1',
        user: { id: 'user-1' }
    }, res)

    assert.equal(res.statusCode, 204)
    assert.deepEqual(calls, [{ name: 'deleteService', args: [ID, 'token-1', 'user-1'] }])
})
