export const TIME_ZONE = 'America/Fortaleza'

export function getErrorMessage(error, fallback, statusMessages = {}) {
    const status = error?.response?.status
    if (status && Object.hasOwn(statusMessages, status)) return statusMessages[status]
    if (status === 401) return 'Sua sessão expirou. Entre novamente para continuar.'
    if (status === 404) return 'Não encontramos as informações solicitadas. Confira os dados e tente novamente.'
    if (status === 409) return 'Houve um conflito com uma alteração recente. Atualize os dados e tente novamente.'
    if (status >= 500) return 'Não foi possível concluir a solicitação agora. Tente novamente.'
    if (status === 400) return error?.response?.data?.error || 'Confira os dados informados e tente novamente.'

    return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback
}

export function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}

export function moneyToCents(value) {
    const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(String(value ?? '').trim())
    if (!match) return 0
    const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
    return match[1] ? -cents : cents
}

export function formatDateTime(value) {
    if (!value) return 'Data não informada'
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: TIME_ZONE
    }).format(new Date(value))
}

export function fortalezaToday(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(value))
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
    return `${values.year}-${values.month}-${values.day}`
}

export function fortalezaInputValue(value = new Date()) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date(value))
    const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export function toFortalezaIso(value) {
    if (!value) return ''

    // Inputs from datetime-local fields are already Fortaleza wall-clock times.
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
        const localValue = value.length === 16 ? `${value}:00` : value
        return `${localValue}-03:00`
    }

    // Instants (for example, availability slots) must be converted to Fortaleza first.
    const instant = new Date(value)
    if (Number.isNaN(instant.getTime())) return ''
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(instant)
    const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}-03:00`
}

export function exclusiveEnd(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ''
    const next = new Date(`${date}T12:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString().slice(0, 10)
}

export function periodBounds(fromDate, toDate) {
    const from = `${fromDate}T00:00:00-03:00`
    const to = `${exclusiveEnd(toDate)}T00:00:00-03:00`
    const invalid = !fromDate || !toDate || fromDate > toDate
    return { from, to, invalid }
}

export function formatTimeInput(value) {
    function fromDigits(digits) {
        if (digits.length <= 2) return digits
        const firstTwo = Number(digits.slice(0, 2))
        const hourLength = (digits.length === 3 && Number(digits[0]) > 2)
            || (digits.length === 4 && firstTwo > 23) ? 1 : 2
        return `${digits.slice(0, hourLength).padStart(2, '0')}:${digits.slice(hourLength, 4)}`
    }

    const text = String(value ?? '')
    const [rawHour, ...rest] = text.split(':')
    if (rest.length > 0) {
        const hour = rawHour.replace(/\D/g, '').slice(-2)
        const minute = rest.join('').replace(/\D/g, '').slice(0, 2)
        if (!hour) return fromDigits(text.replace(/\D/g, '').slice(0, 4))
        if (!minute) return hour
        return fromDigits(`${hour.padStart(2, '0')}${minute}`.slice(0, 4))
    }

    return fromDigits(text.replace(/\D/g, '').slice(0, 4))
}

export function newIdempotencyKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16)
        const value = character === 'x' ? random : (random & 0x3) | 0x8
        return value.toString(16)
    })
}
