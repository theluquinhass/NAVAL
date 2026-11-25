const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/
const INTEGER_PATTERN = /^\d+$/
const MAX_MONEY = 99999999.99
const MAX_QUANTITY = 100000
const MAX_ITEMS = 50

const PRODUCT_FIELDS = new Set(['name', 'description', 'price', 'cost', 'sku', 'lowStockThreshold'])
const MOVEMENT_FIELDS = new Set(['productId', 'movementType', 'quantity', 'direction', 'reason', 'note'])
const SALE_FIELDS = new Set(['items', 'paymentMethod', 'soldAt', 'note', 'idempotencyKey'])
const SALE_ITEM_FIELDS = new Set(['productId', 'quantity'])
const SALE_REFUND_FIELDS = new Set(['refundedAt', 'reason'])

function isStrictIsoDateTime(value) {
    if (typeof value !== 'string') return false
    const match = ISO_DATETIME_PATTERN.exec(value)
    if (!match) return false

    const [, year, month, day, hour, minute, second, zone, , offsetHour, offsetMinute] = match
    const calendarDate = new Date(0)
    calendarDate.setUTCFullYear(Number(year), Number(month) - 1, Number(day))
    calendarDate.setUTCHours(Number(hour), Number(minute), Number(second), 0)

    if (
        calendarDate.getUTCFullYear() !== Number(year) ||
        calendarDate.getUTCMonth() !== Number(month) - 1 ||
        calendarDate.getUTCDate() !== Number(day)
    ) {
        return false
    }

    if (zone !== 'Z') {
        const hours = Number(offsetHour)
        const minutes = Number(offsetMinute)
        if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return false
    }

    return Number.isFinite(Date.parse(value))
}

function rejectExtraFields(body, allowedFields) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'O corpo da requisição deve ser um objeto.'
    const extraFields = Object.keys(body).filter((field) => !allowedFields.has(field))
    return extraFields.length > 0 ? `Campo(s) não permitido(s): ${extraFields.join(', ')}.` : null
}

function validateOptionalText(value, label, maxLength) {
    if (value === undefined || value === null || value === '') return { text: null }
    if (typeof value !== 'string') return { error: `O campo ${label} deve ser um texto.` }
    const text = value.trim()
    if (text.length > maxLength) return { error: `O campo ${label} deve ter no máximo ${maxLength} caracteres.` }
    return { text: text || null }
}

function validateRequiredText(value, label, maxLength) {
    const result = validateOptionalText(value, label, maxLength)
    if (result.error) return result
    if (!result.text) return { error: `Informe o campo ${label}.` }
    return result
}

function validateMoney(value, label, { allowZero = false } = {}) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return { error: `O campo ${label} deve ser um valor monetário.` }
    }
    const text = String(value)
    if (!MONEY_PATTERN.test(text) || !Number.isFinite(Number(text))) {
        return { error: `O campo ${label} deve ter no máximo duas casas decimais.` }
    }
    const amount = Number(text)
    const minimum = allowZero ? 0 : 0.01
    if (amount < minimum || amount > MAX_MONEY) {
        const minimumLabel = allowZero ? '0' : '0,01'
        return { error: `O campo ${label} deve estar entre ${minimumLabel} e ${MAX_MONEY}.` }
    }
    return { amount: amount.toFixed(2) }
}

function validateOptionalMoney(value, label, { allowZero = true } = {}) {
    if (value === undefined || value === null || value === '') return { amount: null }
    return validateMoney(value, label, { allowZero })
}

function validateInteger(value, label, { max = MAX_QUANTITY, required = true } = {}) {
    if (!required && (value === undefined || value === null || value === '')) return { number: null }
    if (typeof value !== 'number' && typeof value !== 'string') {
        return { error: `O campo ${label} deve ser um número inteiro.` }
    }
    const text = String(value)
    if (!INTEGER_PATTERN.test(text)) return { error: `O campo ${label} deve ser um número inteiro positivo.` }
    const number = Number(text)
    if (!Number.isSafeInteger(number) || number < 1 || number > max) {
        return { error: `O campo ${label} deve estar entre 1 e ${max}.` }
    }
    return { number }
}

function validateThreshold(value) {
    if (value === undefined || value === null || value === '') return { number: null }
    if (typeof value !== 'number' && typeof value !== 'string') {
        return { error: 'O campo lowStockThreshold deve ser um número inteiro.' }
    }
    const text = String(value)
    if (!INTEGER_PATTERN.test(text)) return { error: 'O campo lowStockThreshold deve ser um número inteiro positivo.' }
    const number = Number(text)
    if (!Number.isSafeInteger(number) || number > MAX_QUANTITY) {
        return { error: `O campo lowStockThreshold deve estar entre 0 e ${MAX_QUANTITY}.` }
    }
    return { number }
}

export function validateProductPayload(body) {
    const extraError = rejectExtraFields(body, PRODUCT_FIELDS)
    if (extraError) return { error: extraError }

    const name = validateRequiredText(body.name, 'name', 120)
    if (name.error) return name
    const description = validateOptionalText(body.description, 'description', 500)
    if (description.error) return description
    const price = validateMoney(body.price, 'price')
    if (price.error) return price
    const cost = validateOptionalMoney(body.cost, 'cost')
    if (cost.error) return cost
    const sku = validateOptionalText(body.sku, 'sku', 64)
    if (sku.error) return sku
    const threshold = validateThreshold(body.lowStockThreshold)
    if (threshold.error) return threshold

    return {
        payload: {
            name: name.text,
            description: description.text,
            price: price.amount,
            cost: cost.amount,
            sku: sku.text ? sku.text.toUpperCase() : null,
            lowStockThreshold: threshold.number
        }
    }
}

export function validateProductActivePayload(body) {
    const extraError = rejectExtraFields(body, new Set(['isActive']))
    if (extraError) return { error: extraError }
    if (typeof body.isActive !== 'boolean') {
        return { error: 'O campo isActive deve ser booleano.' }
    }
    return { payload: { isActive: body.isActive } }
}

export function validateMovementPayload(body) {
    const extraError = rejectExtraFields(body, MOVEMENT_FIELDS)
    if (extraError) return { error: extraError }

    if (typeof body.productId !== 'string' || !UUID_PATTERN.test(body.productId)) {
        return { error: 'O campo productId deve ser um UUID válido.' }
    }
    if (!['entry', 'adjustment'].includes(body.movementType)) {
        return { error: 'O campo movementType deve ser entry ou adjustment.' }
    }
    const quantity = validateInteger(body.quantity, 'quantity')
    if (quantity.error) return quantity

    const reason = validateOptionalText(body.reason, 'reason', 500)
    if (reason.error) return reason
    const note = validateOptionalText(body.note, 'note', 500)
    if (note.error) return note

    let direction = null
    if (body.movementType === 'entry') {
        if (body.direction !== undefined && body.direction !== null && body.direction !== 1) {
            return { error: 'Entradas de estoque não podem ter direção negativa.' }
        }
    } else {
        if (body.direction !== 1 && body.direction !== -1) {
            return { error: 'Ajustes exigem direction igual a 1 ou -1.' }
        }
        if (!reason.text) return { error: 'Ajustes de estoque exigem motivo.' }
        direction = body.direction
    }

    return {
        payload: {
            productId: body.productId,
            movementType: body.movementType,
            quantity: quantity.number,
            direction,
            reason: reason.text,
            note: note.text
        }
    }
}

export function validateSalePayload(body) {
    const extraError = rejectExtraFields(body, SALE_FIELDS)
    if (extraError) return { error: extraError }

    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
        return { error: `Informe entre 1 e ${MAX_ITEMS} itens na venda.` }
    }

    const items = []
    const seenProductIds = new Set()
    for (const item of body.items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return { error: 'Cada item da venda deve ser um objeto.' }
        }
        const itemFields = Object.keys(item).filter((field) => !SALE_ITEM_FIELDS.has(field))
        if (itemFields.length > 0) return { error: `Campo(s) não permitido(s) no item: ${itemFields.join(', ')}.` }
        if (typeof item.productId !== 'string' || !UUID_PATTERN.test(item.productId)) {
            return { error: 'Cada item deve ter um productId UUID válido.' }
        }
        if (seenProductIds.has(item.productId)) {
            return { error: 'Não repita produtos na mesma venda. Ajuste a quantidade.' }
        }
        const quantity = validateInteger(item.quantity, 'quantity')
        if (quantity.error) return quantity
        seenProductIds.add(item.productId)
        items.push({ productId: item.productId, quantity: quantity.number })
    }

    const paymentMethod = validateRequiredText(body.paymentMethod, 'paymentMethod', 50)
    if (paymentMethod.error) return paymentMethod
    if (!isStrictIsoDateTime(body.soldAt)) {
        return { error: 'O campo soldAt deve ser uma data ISO 8601 com timezone explícito.' }
    }
    const note = validateOptionalText(body.note, 'note', 500)
    if (note.error) return note

    let idempotencyKey = null
    if (body.idempotencyKey !== undefined && body.idempotencyKey !== null && body.idempotencyKey !== '') {
        if (typeof body.idempotencyKey !== 'string' || !UUID_PATTERN.test(body.idempotencyKey)) {
            return { error: 'O campo idempotencyKey deve ser um UUID válido.' }
        }
        idempotencyKey = body.idempotencyKey
    }

    return {
        payload: {
            items,
            paymentMethod: paymentMethod.text,
            soldAt: body.soldAt,
            note: note.text,
            idempotencyKey
        }
    }
}

export function validateSaleRefundPayload(body) {
    const extraError = rejectExtraFields(body, SALE_REFUND_FIELDS)
    if (extraError) return { error: extraError }
    if (!isStrictIsoDateTime(body.refundedAt)) {
        return { error: 'O campo refundedAt deve ser uma data ISO 8601 com timezone explícito.' }
    }
    const reason = validateRequiredText(body.reason, 'reason', 500)
    if (reason.error) return reason

    return {
        payload: {
            refundedAt: body.refundedAt,
            reason: reason.text
        }
    }
}

export function validateProductId(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function validateMovementProductFilter(query) {
    if (!query || typeof query !== 'object') return { error: 'Informe os parâmetros da consulta.' }
    const { productId } = query
    if (productId === undefined || productId === null || productId === '') return { productId: null }
    if (typeof productId !== 'string' || !UUID_PATTERN.test(productId)) {
        return { error: 'O campo productId deve ser um UUID válido.' }
    }
    return { productId }
}

export function validateSalePeriod(query) {
    if (!query || typeof query !== 'object') return { error: 'Informe o período.' }
    const { from, to } = query
    if (!isStrictIsoDateTime(from) || !isStrictIsoDateTime(to)) {
        return { error: 'Informe from e to como ISO 8601 com timezone explícito.' }
    }
    if (Date.parse(from) >= Date.parse(to)) {
        return { error: 'O início do período deve ser anterior ao fim.' }
    }
    return { period: { from, to } }
}
