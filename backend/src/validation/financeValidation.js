const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/
const MAX_MONEY = 99999999.99
const MAX_PERIOD_DAYS = 366

const PAYMENT_FIELDS = new Set(['appointmentId', 'amount', 'paidAt', 'method', 'note'])
const REFUND_FIELDS = new Set(['paymentId', 'amount', 'refundedAt', 'reason'])
const EXPENSE_FIELDS = new Set(['categoryId', 'description', 'amount', 'spentAt', 'paymentMethod', 'note'])
const CATEGORY_FIELDS = new Set(['name', 'isActive'])

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

function validateMoney(value, label) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return { error: `O campo ${label} deve ser um valor monetário.` }
    }
    const text = String(value)
    if (!MONEY_PATTERN.test(text) || !Number.isFinite(Number(text))) {
        return { error: `O campo ${label} deve ter no máximo duas casas decimais.` }
    }
    const amount = Number(text)
    if (amount <= 0 || amount > MAX_MONEY) {
        return { error: `O campo ${label} deve estar entre 0,01 e ${MAX_MONEY}.` }
    }
    return { amount: amount.toFixed(2) }
}

function validateOptionalText(value, label, maxLength) {
    if (value === undefined || value === null || value === '') return { text: null }
    if (typeof value !== 'string') return { error: `O campo ${label} deve ser um texto.` }
    const text = value.trim()
    if (text.length > maxLength) return { error: `O campo ${label} deve ter no máximo ${maxLength} caracteres.` }
    return { text: text || null }
}

function rejectExtraFields(body, allowedFields) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'O corpo da requisição deve ser um objeto.'
    const extraFields = Object.keys(body).filter((field) => !allowedFields.has(field))
    return extraFields.length > 0 ? `Campo(s) não permitido(s): ${extraFields.join(', ')}.` : null
}

export function validatePeriod(query) {
    if (!query || typeof query !== 'object') return { error: 'Informe o período.' }
    const { from, to } = query
    if (!isStrictIsoDateTime(from) || !isStrictIsoDateTime(to)) {
        return { error: 'Informe from e to como ISO 8601 com timezone explícito.' }
    }
    const fromTime = Date.parse(from)
    const toTime = Date.parse(to)
    if (fromTime >= toTime) return { error: 'O início do período deve ser anterior ao fim.' }
    if (toTime - fromTime > MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000) {
        return { error: `O período não pode ultrapassar ${MAX_PERIOD_DAYS} dias.` }
    }
    return { period: { from, to } }
}

export function validatePaymentPayload(body) {
    const extraError = rejectExtraFields(body, PAYMENT_FIELDS)
    if (extraError) return { error: extraError }

    const appointmentId = body.appointmentId ?? null
    if (appointmentId !== null && (typeof appointmentId !== 'string' || !UUID_PATTERN.test(appointmentId))) {
        return { error: 'O campo appointmentId deve ser um UUID válido.' }
    }

    const money = validateMoney(body.amount, 'amount')
    if (money.error) return money

    if (!isStrictIsoDateTime(body.paidAt)) {
        return { error: 'O campo paidAt deve ser uma data ISO 8601 com timezone explícito.' }
    }
    if (typeof body.method !== 'string' || !body.method.trim()) {
        return { error: 'Informe a forma de pagamento.' }
    }
    const method = validateOptionalText(body.method, 'method', 50)
    if (method.error) return method
    const note = validateOptionalText(body.note, 'note', 500)
    if (note.error) return note

    return {
        payload: {
            appointmentId,
            amount: money.amount,
            paidAt: body.paidAt,
            method: method.text,
            note: note.text
        }
    }
}

export function validateRefundPayload(body) {
    const extraError = rejectExtraFields(body, REFUND_FIELDS)
    if (extraError) return { error: extraError }

    if (typeof body.paymentId !== 'string' || !UUID_PATTERN.test(body.paymentId)) {
        return { error: 'O campo paymentId deve ser um UUID válido.' }
    }
    const money = validateMoney(body.amount, 'amount')
    if (money.error) return money
    if (!isStrictIsoDateTime(body.refundedAt)) {
        return { error: 'O campo refundedAt deve ser uma data ISO 8601 com timezone explícito.' }
    }
    const reason = validateOptionalText(body.reason, 'reason', 500)
    if (reason.error) return reason

    return {
        payload: {
            paymentId: body.paymentId,
            amount: money.amount,
            refundedAt: body.refundedAt,
            reason: reason.text
        }
    }
}

export function validateExpensePayload(body) {
    const extraError = rejectExtraFields(body, EXPENSE_FIELDS)
    if (extraError) return { error: extraError }

    const categoryId = body.categoryId ?? null
    if (categoryId !== null && (typeof categoryId !== 'string' || !UUID_PATTERN.test(categoryId))) {
        return { error: 'O campo categoryId deve ser um UUID válido.' }
    }
    const description = validateOptionalText(body.description, 'description', 200)
    if (description.error) return description
    if (!description.text) return { error: 'Informe a descrição da despesa.' }

    const money = validateMoney(body.amount, 'amount')
    if (money.error) return money
    if (!isStrictIsoDateTime(body.spentAt)) {
        return { error: 'O campo spentAt deve ser uma data ISO 8601 com timezone explícito.' }
    }
    const paymentMethod = validateOptionalText(body.paymentMethod, 'paymentMethod', 50)
    if (paymentMethod.error) return paymentMethod
    const note = validateOptionalText(body.note, 'note', 500)
    if (note.error) return note

    return {
        payload: {
            categoryId,
            description: description.text,
            amount: money.amount,
            spentAt: body.spentAt,
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
    return typeof value === 'string' && UUID_PATTERN.test(value)
}
