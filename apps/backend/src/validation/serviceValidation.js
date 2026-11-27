export function validateServicePayload(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'O corpo da requisição deve ser um objeto.' }
    }

    const { name, description, price, duration } = body

    if (typeof name !== 'string') {
        return { error: 'O campo name deve ser um texto.' }
    }
    if (!name.trim()) {
        return { error: 'O campo name não pode estar vazio.' }
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
        return { error: 'O campo description deve ser um texto ou null.' }
    }

    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
        return { error: 'O campo price deve ser um número maior que zero.' }
    }
    if (price > 99999999.99) {
        return { error: 'O campo price excede o limite de 99999999.99.' }
    }

    const [coefficient, exponentString] = price.toString().toLowerCase().split('e')
    const decimalPlaces = (coefficient.split('.')[1]?.length ?? 0) - Number(exponentString ?? 0)
    if (decimalPlaces > 2) {
        return { error: 'O campo price deve ter no máximo duas casas decimais.' }
    }

    if (typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0) {
        return { error: 'O campo duration deve ser um número inteiro maior que zero.' }
    }

    return {
        payload: {
            name: name.trim(),
            description: typeof description === 'string' ? description.trim() || null : null,
            price,
            duration
        }
    }
}
