import {
    isUuid,
    rejectExtraFields,
    validateBusinessDate,
    validateMoney,
    validateOptionalText,
    validatePeriod as validateSharedPeriod,
    validateRequiredText
} from './shared.js'

const INTEGER_PATTERN = /^\d+$/
const MAX_QUANTITY = 100000
const MAX_ITEMS = 50

const PRODUCT_FIELDS = new Set(['name', 'description', 'price', 'cost', 'sku', 'lowStockThreshold'])
const MOVEMENT_FIELDS = new Set(['productId', 'movementType', 'quantity', 'direction', 'reason', 'note'])
const SALE_FIELDS = new Set(['items', 'paymentMethod', 'soldAt', 'note', 'idempotencyKey'])
const SALE_ITEM_FIELDS = new Set(['productId', 'quantity'])
const SALE_REFUND_FIELDS = new Set(['refundedAt', 'reason'])

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

    if (!isUuid(body.productId)) {
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
        if (!isUuid(item.productId)) {
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
    const soldAt = validateBusinessDate(body.soldAt, 'soldAt')
    if (soldAt.error) return soldAt
    const note = validateOptionalText(body.note, 'note', 500)
    if (note.error) return note

    let idempotencyKey = null
    if (body.idempotencyKey !== undefined && body.idempotencyKey !== null && body.idempotencyKey !== '') {
        if (!isUuid(body.idempotencyKey)) {
            return { error: 'O campo idempotencyKey deve ser um UUID válido.' }
        }
        idempotencyKey = body.idempotencyKey
    }

    return {
        payload: {
            items,
            paymentMethod: paymentMethod.text,
            soldAt: soldAt.date,
            note: note.text,
            idempotencyKey
        }
    }
}

export function validateSaleRefundPayload(body) {
    const extraError = rejectExtraFields(body, SALE_REFUND_FIELDS)
    if (extraError) return { error: extraError }
    const refundedAt = validateBusinessDate(body.refundedAt, 'refundedAt')
    if (refundedAt.error) return refundedAt
    const reason = validateRequiredText(body.reason, 'reason', 500)
    if (reason.error) return reason

    return {
        payload: {
            refundedAt: refundedAt.date,
            reason: reason.text
        }
    }
}

export function validateProductId(value) {
    return isUuid(value)
}

export function validateMovementProductFilter(query) {
    if (!query || typeof query !== 'object') return { error: 'Informe os parâmetros da consulta.' }
    const { productId } = query
    if (productId === undefined || productId === null || productId === '') return { productId: null }
    if (!isUuid(productId)) {
        return { error: 'O campo productId deve ser um UUID válido.' }
    }
    return { productId }
}

export function validateSalePeriod(query) {
    return validateSharedPeriod(query)
}
