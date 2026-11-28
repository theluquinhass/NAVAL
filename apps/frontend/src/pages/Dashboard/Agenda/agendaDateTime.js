import { addDays, TIME_ZONE } from '../../../utils/dashboard.js'

// Keep the old export available for cached bundles that still import it.
// The canonical implementation lives in utils/dashboard.js.
export {
    TIME_ZONE,
    fortalezaToday as getLocalDateValue,
    toFortalezaIso
} from '../../../utils/dashboard.js'

export function shiftDate(dateValue, amount) {
    return addDays(dateValue, amount)
}

export function getDayRange(dateValue) {
    const start = new Date(`${dateValue}T00:00:00-03:00`)
    const end = new Date(`${shiftDate(dateValue, 1)}T00:00:00-03:00`)
    return { from: start.toISOString(), to: end.toISOString() }
}

// Monday-based business week containing `dateValue`.
export function getWeekDays(dateValue) {
    const weekday = new Date(`${dateValue}T12:00:00-03:00`).getUTCDay()
    const monday = shiftDate(dateValue, -((weekday + 6) % 7))
    return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index))
}

export function getWeekRange(dateValue) {
    const days = getWeekDays(dateValue)
    return {
        from: new Date(`${days[0]}T00:00:00-03:00`).toISOString(),
        to: new Date(`${shiftDate(days[6], 1)}T00:00:00-03:00`).toISOString()
    }
}

export function formatWeekRange(dateValue) {
    const days = getWeekDays(dateValue)
    const format = (value, options) => new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, ...options })
        .format(new Date(`${value}T12:00:00-03:00`))
    return `${format(days[0], { day: 'numeric', month: 'short' })} – ${format(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function formatWeekday(dateValue) {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric' })
        .format(new Date(`${dateValue}T12:00:00-03:00`))
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
