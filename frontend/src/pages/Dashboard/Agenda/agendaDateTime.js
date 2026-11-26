import { fortalezaToday, TIME_ZONE } from '../../../utils/dashboard.js'

export { TIME_ZONE, toFortalezaIso } from '../../../utils/dashboard.js'

export function shiftDate(dateValue, amount) {
    const date = new Date(`${dateValue}T12:00:00-03:00`)
    date.setUTCDate(date.getUTCDate() + amount)
    return fortalezaToday(date)
}

export function getDayRange(dateValue) {
    const start = new Date(`${dateValue}T00:00:00-03:00`)
    const end = new Date(`${shiftDate(dateValue, 1)}T00:00:00-03:00`)
    return { from: start.toISOString(), to: end.toISOString() }
}

export function formatSelectedDate(dateValue) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(new Date(`${dateValue}T12:00:00-03:00`))
}

export function formatTime(value) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value))
}
