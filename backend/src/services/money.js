export function toCents(value) {
    return Math.round(Number(value) * 100)
}

export function fromCents(cents) {
    const wholeCents = Math.trunc(Number(cents))
    const sign = wholeCents < 0 ? -1 : 1
    const absolute = Math.abs(wholeCents)
    return sign * (Math.floor(absolute / 100) + (absolute % 100) / 100)
}

export function sumCents(rows, column) {
    return rows.reduce((total, row) => total + toCents(row[column]), 0)
}
