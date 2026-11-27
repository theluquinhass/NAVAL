import {
    isUuid,
    rejectExtraFields,
    validateBusinessDate,
    validateMoney,
    validateOptionalText,
    validatePeriod as validateSharedPeriod
} from './shared.js'

const PAYMENT_FIELDS = new Set(['appointmentId', 'amount', 'paidAt', 'method', 'note', 'idempotencyKey'])
const REFUND_FIELDS = new Set(['paymentId', 'amount', 'refundedAt', 'reason', 'idempotencyKey'])
const EXPENSE_FIELDS = new Set(['categoryId', 'description', 'amount', 'spentAt', 'paymentMethod', 'note'])
const CATEGORY_FIELDS = new Set(['name', 'isActive'])

function validateOptionalIdempotencyKey(value) {
    if (value === undefined || value === null || value === '') return { key: null }
    if (!isUuid(value)) return { error: 'O campo idempotencyKey deve ser um UUID válido.' }
    return { key: value }
}

export function validatePeriod(query) {
    return validateSharedPeriod(query)
}

export function validatePaymentPayload(body) {
    const extraError = rejectExtraFields(body, PAYMENT_FIELDS)
    if (extraError) return { error: extraError }

    const appointmentId = body.appointmentId ?? null
    if (appointmentId !== null && !isUuid(appointmentId)) {
        return { error: 'O campo appointmentId deve ser um UUID válido.' }
    }

    const money = validateMoney(body.amount, 'amount')
    if (money.error) return money

    const paidAt = validateBusinessDate(body.paidAt, 'paidAt')
    if (paidAt.error) return paidAt

    if (typeof body.method !== 'string' || !body.method.trim()) {
        return { error: 'Informe a forma de pagamento.' }
    }
    const method = validateOptionalText(body.method, 'method', 50)
    if (method.error) return method
    const note = validateOptionalText(body.note, 'note', 500)
    if (note.error) return note
    const idempotencyKey = validateOptionalIdempotencyKey(body.idempotencyKey)
    if (idempotencyKey.error) return idempotencyKey

    return {
        payload: {
            appointmentId,
            amount: money.amount,
            paidAt: paidAt.date,
            method: method.text,
            note: note.text,
            idempotencyKey: idempotencyKey.key
        }
    }
}

export function validateRefundPayload(body) {
    const extraError = rejectExtraFields(body, REFUND_FIELDS)
    if (extraError) return { error: extraError }

    if (!isUuid(body.paymentId)) {
        return { error: 'O campo paymentId deve ser um UUID válido.' }
    }
    const money = validateMoney(body.amount, 'amount')
    if (money.error) return money
    const refundedAt = validateBusinessDate(body.refundedAt, 'refundedAt')
    if (refundedAt.error) return refundedAt
    const reason = validateOptionalText(body.reason, 'reason', 500)
    if (reason.error) return reason
    const idempotencyKey = validateOptionalIdempotencyKey(body.idempotencyKey)
    if (idempotencyKey.error) return idempotencyKey

    return {
        payload: {
            paymentId: body.paymentId,
            amount: money.amount,
            refundedAt: refundedAt.date,
            reason: reason.text,
            idempotencyKey: idempotencyKey.key
        }
    }
}

export function validateExpensePayload(body) {
    const extraError = rejectExtraFields(body, EXPENSE_FIELDS)
    if (extraError) return { error: extraError }

    const categoryId = body.categoryId ?? null
    if (categoryId !== null && !isUuid(categoryId)) {
        return { error: 'O campo categoryId deve ser um UUID válido.' }
    }
    const description = validateOptionalText(body.description, 'description', 200)
    if (description.error) return description
    if (!description.text) return { error: 'Informe a descrição da despesa.' }

    const money = validateMoney(body.amount, 'amount')
    if (money.error) return money
    const spentAt = validateBusinessDate(body.spentAt, 'spentAt')
    if (spentAt.error) return spentAt
    const paymentMethod = validateOptionalText(body.paymentMethod, 'paymentMethod', 50)
    if (paymentMethod.error) return paymentMethod
    const note = validateOptionalText(body.note, 'note', 500)
    if (note.error) return note

    return {
        payload: {
            categoryId,
            description: description.text,
            amount: money.amount,
            spentAt: spentAt.date,
            paymentMethod: paymentMethod.text,
            note: note.text
        }
    }
}

export function validateCategoryPayload(body) {
    const extraError = rejectExtraFields(body, CATEGORY_FIELDS)
    if (extraError) return { error: extraError }

    const name = validateOptionalText(body.name, 'name', 80)
    if (name.error) return name
    if (!name.text) return { error: 'Informe o nome da categoria.' }
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
        return { error: 'O campo isActive deve ser booleano.' }
    }

    return {
        payload: {
            name: name.text,
            isActive: body.isActive ?? true
        }
    }
}

export function validateFinanceId(value) {
    return isUuid(value)
}
