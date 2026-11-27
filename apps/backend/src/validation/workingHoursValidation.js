const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const ALLOWED_ROW_FIELDS = new Set(['day_of_week', 'period_index', 'opens_at', 'closes_at'])

export function validateWorkingHoursRows(rows) {
    if (!Array.isArray(rows)) return { error: 'Informe os períodos de funcionamento.' }

    const periodsByDay = Array.from({ length: 7 }, () => [])
    const indexes = new Set()

    for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row) ||
            Object.keys(row).some((key) => !ALLOWED_ROW_FIELDS.has(key))) {
            return { error: 'Um período contém dados inválidos.' }
        }
        if (!Number.isInteger(row.day_of_week) || row.day_of_week < 0 || row.day_of_week > 6 ||
            !Number.isInteger(row.period_index) || row.period_index < 0 ||
            typeof row.opens_at !== 'string' || !TIME_PATTERN.test(row.opens_at) ||
            typeof row.closes_at !== 'string' || !TIME_PATTERN.test(row.closes_at)) {
            return { error: 'Informe dias e horários válidos no formato 24 horas.' }
        }
        if (row.opens_at >= row.closes_at) {
            return { error: 'O início de cada período deve ser anterior ao término.' }
        }

        const key = `${row.day_of_week}:${row.period_index}`
        if (indexes.has(key)) return { error: 'Há períodos duplicados no mesmo dia.' }
        indexes.add(key)
        periodsByDay[row.day_of_week].push(row)
    }

    for (const periods of periodsByDay) {
        periods.sort((a, b) => a.period_index - b.period_index)
        for (let index = 0; index < periods.length; index += 1) {
            if (periods[index].period_index !== index) {
                return { error: 'Os períodos de cada dia devem estar numerados em sequência.' }
            }
            if (index > 0) {
                const previous = periods[index - 1]
                const current = periods[index]
                if (current.opens_at < previous.closes_at) {
                    return { error: 'Os períodos do mesmo dia não podem se sobrepor.' }
                }
                if (current.opens_at < previous.opens_at) {
                    return { error: 'Ordene os períodos de cada dia pelo horário de início.' }
                }
            }
        }
    }

    return { rows }
}
