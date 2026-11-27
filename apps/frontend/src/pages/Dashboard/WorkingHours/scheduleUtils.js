import { TIME_ZONE } from '../../../utils/dashboard.js'

export const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
export const WEEKDAY_INDICES = [1, 2, 3, 4, 5]
export const ALL_DAY_INDICES = weekdays.map((_, index) => index)
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function completeTime(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, 4)
    if (digits.length === 0) return ''
    return `${digits.slice(0, 2).padStart(2, '0')}:${digits.slice(2).padEnd(2, '0')}`
}

export function dayTotalMinutes(day) {
    if (!day.enabled) return 0
    return day.periods.reduce((total, period) => {
        if (!TIME_PATTERN.test(period.opens_at) || !TIME_PATTERN.test(period.closes_at)) return total
        const [openHour, openMinute] = period.opens_at.split(':').map(Number)
        const [closeHour, closeMinute] = period.closes_at.split(':').map(Number)
        const minutes = (closeHour * 60 + closeMinute) - (openHour * 60 + openMinute)
        return minutes > 0 ? total + minutes : total
    }, 0)
}

export function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    if (hours === 0) return `${remainder}min`
    return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}min`
}

export function createEmptyWeek() {
    return weekdays.map((_, day_of_week) => ({ day_of_week, enabled: false, periods: [] }))
}

export function mapSavedHours(saved = []) {
    const week = createEmptyWeek()
    for (const row of [...saved].sort((a, b) => a.day_of_week - b.day_of_week || a.period_index - b.period_index)) {
        const day = week[row.day_of_week]
        if (!day) continue
        day.enabled = true
        day.periods.push({
            opens_at: row.opens_at?.slice(0, 5) ?? '',
            closes_at: row.closes_at?.slice(0, 5) ?? ''
        })
    }
    return week
}

export function getScheduleErrors(days) {
    const errors = {}

    for (const day of days.filter((item) => item.enabled)) {
        if (day.periods.length === 0) {
            errors[day.day_of_week] = 'Adicione pelo menos um período ou feche este dia.'
            continue
        }

        for (let index = 0; index < day.periods.length; index += 1) {
            const period = day.periods[index]
            if (!TIME_PATTERN.test(period.opens_at) || !TIME_PATTERN.test(period.closes_at)) {
                errors[day.day_of_week] = `Preencha início e término do período ${index + 1} no formato HH:mm.`
                break
            }
            if (period.opens_at >= period.closes_at) {
                errors[day.day_of_week] = `No período ${index + 1}, o início deve ser anterior ao término.`
                break
            }
            if (index > 0) {
                const previous = day.periods[index - 1]
                if (period.opens_at < previous.closes_at) {
                    errors[day.day_of_week] = `O período ${index + 1} se sobrepõe ao período anterior. Ajuste os horários ou remova o intervalo.`
                    break
                }
                if (period.opens_at < previous.opens_at) {
                    errors[day.day_of_week] = 'Ordene os períodos do dia pelo horário de início.'
                    break
                }
            }
        }
    }

    return errors
}

export function formatAppointmentDate(value) {
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: TIME_ZONE
    }).format(new Date(value))
}
