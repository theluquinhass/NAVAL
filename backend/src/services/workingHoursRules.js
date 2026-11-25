const TIME_ZONE = 'America/Fortaleza'
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function fortalezaDateTimeParts(value) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date(value))
    return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value: partValue }) => [type, partValue]))
}

export function weekdayIndexForDate(value) {
    return WEEKDAY_NAMES.indexOf(fortalezaDateTimeParts(value).weekday)
}

export function timeToMinutes(value) {
    const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
    return hour * 60 + minute
}

export function isWithinWorkingHours(startsAt, endsAt, periods) {
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.getTime() >= end.getTime()) return false

    const startParts = fortalezaDateTimeParts(start)
    const endParts = fortalezaDateTimeParts(end)
    const sameLocalDate = startParts.year === endParts.year &&
        startParts.month === endParts.month &&
        startParts.day === endParts.day
    if (!sameLocalDate) return false

    const startMinutes = Number(startParts.hour) * 60 + Number(startParts.minute)
    const endMinutes = Number(endParts.hour) * 60 + Number(endParts.minute)

    return (periods ?? []).some((period) => (
        startMinutes >= timeToMinutes(period.opens_at) &&
        endMinutes <= timeToMinutes(period.closes_at)
    ))
}
