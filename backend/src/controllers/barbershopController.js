import createProfileService from "../services/barbershopService.js";

export async function createProfile(req, res) {
    try {
        const { name, phone} = req.body
    
        if(!name?.trim() || !phone?.trim()) {
            return res.status(400).json({
                error: 'Nome e Telefone sao obrigatorios'
            })
        }

        const payload = {
            name: name.trim(),
            slug: name.trim().toLowerCase().replaceAll(' ', '-'),
            phone: phone,
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
export default{
    createProfile
}