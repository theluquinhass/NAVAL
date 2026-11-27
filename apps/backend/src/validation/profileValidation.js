const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeSlug(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function validateProfilePayload(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'Dados do perfil inválidos.' }
    }

    if (typeof body.barberName !== 'string' || body.barberName.trim().length === 0 || body.barberName.trim().length > 120) {
        return { error: 'Informe o nome do barbeiro.' }
    }
    if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.trim().length > 120) {
        return { error: 'Informe o nome da barbearia.' }
    }
    if (typeof body.phone !== 'string' || body.phone.trim().length === 0 || body.phone.trim().length > 40) {
        return { error: 'Informe o telefone da barbearia.' }
    }
    if (typeof body.slug !== 'string') {
        return { error: 'Informe o endereço do perfil.' }
    }
    if (body.sellsProducts !== undefined && typeof body.sellsProducts !== 'boolean') {
        return { error: 'A opção de vender produtos deve ser sim ou não.' }
    }

    const slug = normalizeSlug(body.slug)
    if (slug.length === 0 || slug.length > 80 || !SLUG_PATTERN.test(slug)) {
        return { error: 'O endereço do perfil deve conter apenas letras, números e hífens.' }
    }

    return {
        payload: {
            barberName: body.barberName.trim(),
            name: body.name.trim(),
            phone: body.phone.trim(),
            slug,
            sellsProducts: body.sellsProducts === true
        }
    }
}

export const validateProfileUpdatePayload = validateProfilePayload
