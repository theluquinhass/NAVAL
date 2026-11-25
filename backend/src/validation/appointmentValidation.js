const ALLOWED_FIELDS = new Set(['customerName', 'customerPhone', 'serviceId', 'startsAt'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/
const PHONE_CHARACTERS_PATTERN = /^\+?[0-9][0-9().\s-]*[0-9]$/
const MIN_PHONE_DIGITS = 7
const MAX_PHONE_DIGITS = 15
const MAX_PHONE_LENGTH = 25
const MAX_CUSTOMER_NAME_LENGTH = 100

function isStrictIsoDateTime(value) {
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

export function validateAppointmentPayload(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'O corpo da requisição deve ser um objeto.' }
    }

    const extraFields = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field))
    if (extraFields.length > 0) {
        return { error: `Campo(s) não permitido(s): ${extraFields.join(', ')}.` }
    }

    for (const field of ALLOWED_FIELDS) {
        if (!Object.hasOwn(body, field)) {
            return { error: `O campo ${field} é obrigatório.` }
        }
    }

    const { customerName, customerPhone, serviceId, startsAt } = body

    if (typeof customerName !== 'string') {
        return { error: 'O campo customerName deve ser um texto.' }
    }
    const normalizedName = customerName.trim()
    if (!normalizedName) {
        return { error: 'O campo customerName não pode estar vazio.' }
    }
    if (normalizedName.length > MAX_CUSTOMER_NAME_LENGTH) {
        return { error: `O campo customerName deve ter no máximo ${MAX_CUSTOMER_NAME_LENGTH} caracteres.` }
    }

    if (typeof customerPhone !== 'string') {
        return { error: 'O campo customerPhone deve ser um texto.' }
    }
    const normalizedPhone = customerPhone.trim()
    const phoneDigits = normalizedPhone.replace(/\D/g, '').length
    if (
        !normalizedPhone ||
        normalizedPhone.length > MAX_PHONE_LENGTH ||
        !PHONE_CHARACTERS_PATTERN.test(normalizedPhone) ||
        phoneDigits < MIN_PHONE_DIGITS ||
        phoneDigits > MAX_PHONE_DIGITS
    ) {
        return { error: `O campo customerPhone deve conter entre ${MIN_PHONE_DIGITS} e ${MAX_PHONE_DIGITS} dígitos e usar somente caracteres de telefone válidos.` }
    }

    if (typeof serviceId !== 'string' || !UUID_PATTERN.test(serviceId)) {
        return { error: 'O campo serviceId deve ser um UUID válido.' }
    }

    if (typeof startsAt !== 'string' || !isStrictIsoDateTime(startsAt)) {
        return { error: 'O campo startsAt deve ser uma data ISO 8601 válida com timezone explícito.' }
    }

    return {
        payload: {
            customerName: normalizedName,
            customerPhone: normalizedPhone,
            serviceId,
            startsAt
        }
    }
}
