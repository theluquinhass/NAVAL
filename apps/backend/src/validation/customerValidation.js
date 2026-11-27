const ALLOWED_FIELDS = new Set(['name', 'phone'])

function validatePayload(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'Informe os dados do cliente.' }
    }

    if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) {
        return { error: 'O payload contém campos não permitidos.' }
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
        return { error: 'Informe o nome do cliente.' }
    }
    const name = body.name.trim()
    if (name.length > 100) return { error: 'O nome deve ter no máximo 100 caracteres.' }

    if (typeof body.phone !== 'string' || !body.phone.trim()) {
        return { error: 'Informe o telefone do cliente.' }
    }
    const phone = body.phone.trim()
    const digits = phone.replace(/\D/g, '')
    if (phone.length > 25 || !/^\+?[0-9][0-9().\s-]*[0-9]$/.test(phone) || digits.length < 7 || digits.length > 15) {
        return { error: 'Informe um telefone válido com 7 a 15 dígitos.' }
    }

    return { payload: { name, phone } }
}

export function validateCustomerPayload(body) {
    return validatePayload(body)
}

export function validateCustomerId(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function validateCustomerSearch(value) {
    if (value === undefined) return { search: '' }
    if (typeof value !== 'string' || value.length > 100) {
        return { error: 'A busca deve ter no máximo 100 caracteres.' }
    }

    // Limita a expressão PostgREST a letras, números e espaços, evitando que
    // caracteres de sintaxe do filtro sejam interpretados como operadores.
    return { search: value.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() }
}
