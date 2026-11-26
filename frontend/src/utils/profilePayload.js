import { normalizeSlug } from './slug.js'

export function buildProfilePayload({ barberName, name, phone, slug, sellsProducts }) {
    return {
        barberName: barberName.trim(),
        name: name.trim(),
        phone: phone.trim(),
        slug: normalizeSlug(slug || name),
        sellsProducts: sellsProducts === true
    }
}
