export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ISO_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/
export const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/
export const MAX_MONEY = 99999999.99
export const MAX_PERIOD_DAYS = 366
export const DEFAULT_PAGE_LIMIT = 500
export const MAX_PAGE_LIMIT = 1000
export const DEFAULT_PAGINATION = { limit: DEFAULT_PAGE_LIMIT, offset: 0 }
export const MAX_PAST_YEARS = 5
export const MAX_FUTURE_DAYS = 1

export function isUuid(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isStrictCalendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setUTCFullYear(year, month - 1, day)
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isStrictIsoDateTime(value) {
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

export function validateMoney(value, label, { allowZero = false } = {}) {
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

export function validateOptionalText(value, label, maxLength) {
    if (value === undefined || value === null || value === '') return { text: null }
    if (typeof value !== 'string') return { error: `O campo ${label} deve ser um texto.` }
    const text = value.trim()
    if (text.length > maxLength) return { error: `O campo ${label} deve ter no máximo ${maxLength} caracteres.` }
    return { text: text || null }
}

export function validateRequiredText(value, label, maxLength) {
    const result = validateOptionalText(value, label, maxLength)
    if (result.error) return result
    if (!result.text) return { error: `Informe o campo ${label}.` }
    return result
}

export function rejectExtraFields(body, allowedFields) {
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

// Creation dates (payments, refunds, expenses and sales) must be recent enough
// to avoid corrupting the ledger with accidental or guessed dates.
export function validateBusinessDate(value, label, { now = Date.now() } = {}) {
    if (!isStrictIsoDateTime(value)) {
        return { error: `O campo ${label} deve ser uma data ISO 8601 com timezone explícito.` }
    }
    const time = Date.parse(value)
    const earliest = new Date(now)
    earliest.setUTCFullYear(earliest.getUTCFullYear() - MAX_PAST_YEARS)
    if (time < earliest.getTime()) {
        return { error: `O campo ${label} não pode ser anterior a ${MAX_PAST_YEARS} anos.` }
    }
    if (time > now + MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000) {
        return { error: `O campo ${label} não pode estar mais de ${MAX_FUTURE_DAYS} dia no futuro.` }
    }
    return { date: value }
}

function parsePageValue(value, label, { minimum, maximum, fallback }) {
    if (value === undefined || value === null || value === '') return { value: fallback }
    if (typeof value !== 'string' && typeof value !== 'number') {
        return { error: `O campo ${label} deve ser um número inteiro.` }
    }
    const text = String(value)
    if (!/^\d+$/.test(text)) return { error: `O campo ${label} deve ser um número inteiro.` }
    const number = Number(text)
    if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
        return { error: `O campo ${label} deve estar entre ${minimum} e ${maximum}.` }
    }
    return { value: number }
}

export function validatePagination(query) {
    if (!query || typeof query !== 'object') return { error: 'Informe os parâmetros de paginação.' }

    const limit = parsePageValue(query.limit, 'limit', {
        minimum: 1,
        maximum: MAX_PAGE_LIMIT,
        fallback: DEFAULT_PAGE_LIMIT
    })
    if (limit.error) return { error: limit.error }

    const offset = parsePageValue(query.offset, 'offset', {
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER,
        fallback: 0
    })
    if (offset.error) return { error: offset.error }

    return { pagination: { limit: limit.value, offset: offset.value } }
}
