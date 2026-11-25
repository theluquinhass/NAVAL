export const TIME_ZONE = 'America/Fortaleza'

export function getErrorMessage(error, fallback) {
    if (error?.response?.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.'
    return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback
}

export function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}

export function formatDateTime(value) {
    if (!value) return 'Data não informada'
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: TIME_ZONE
    }).format(new Date(value))
}

export function fortalezaToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date())
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

export function toFortalezaIso(localDateTime) {
    return localDateTime ? `${localDateTime}:00-03:00` : ''
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

export function newIdempotencyKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16)
        const value = character === 'x' ? random : (random & 0x3) | 0x8
        return value.toString(16)
    })
}
