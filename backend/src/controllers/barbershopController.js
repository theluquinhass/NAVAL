import { createUserClient } from '../config/supabase.js'
import createProfileService, { updateProfileForUser } from '../services/barbershopService.js'
import { validateProfilePayload } from '../validation/profileValidation.js'

export async function createProfile(req, res) {
    const { payload: validatedPayload, error: validationError } = validateProfilePayload({
        ...req.body,
        slug: req.body?.slug || req.body?.name
    })
    if (validationError) return res.status(400).json({ error: validationError })

    try {
        const payload = {
            barber_name: validatedPayload.barberName,
            name: validatedPayload.name,
            slug: validatedPayload.slug,
            phone: validatedPayload.phone,
            sells_products: validatedPayload.sellsProducts,
            user_id: req.user.id
        }

        const data = await createProfileService(payload, req.accessToken)
        return res.status(201).json({
            profile: data
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message
        })
    }
}

export async function updateProfile(req, res) {
    const { payload, error: validationError } = validateProfilePayload(req.body)
    if (validationError) return res.status(400).json({ error: validationError })

    try {
        const profile = await updateProfileForUser(createUserClient(req.accessToken), req.user.id, payload)
        return res.status(200).json({ profile })
    } catch (updateError) {
        if (updateError.message === 'BARBERSHOP_NOT_FOUND') {
            return res.status(404).json({ error: 'Perfil não encontrado.' })
        }
        if (updateError.cause?.code === '23505') {
            return res.status(409).json({ error: 'Este endereço de perfil já está em uso.' })
        }
        return res.status(500).json({ error: 'Não foi possível atualizar o perfil.' })
    }
}

export default {
    createProfile,
    updateProfile
}
