export const TIME_ZONE = 'America/Fortaleza'

export function getLocalDateValue(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date)
}

export function shiftDate(dateValue, amount) {
    const date = new Date(`${dateValue}T12:00:00-03:00`)
    date.setUTCDate(date.getUTCDate() + amount)
    return getLocalDateValue(date)
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

export function toFortalezaIso(value) {
    const instant = new Date(value)
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(instant).map(({ type, value: partValue }) => [type, partValue]))
    const localAsUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
        instant.getUTCMilliseconds()
    )
    const offsetMinutes = Math.round((localAsUtc - instant.getTime()) / 60_000)
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const absoluteOffset = Math.abs(offsetMinutes)
    const offset = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`
}
