import {
    createService as createServiceRecord,
    deleteService as deleteServiceRecord,
    listServices,
    updateService as updateServiceRecord
} from '../services/Services.js'
import { validateServicePayload } from '../validation/serviceValidation.js'
import { isUuid } from '../validation/shared.js'

function handleServiceError(error, res, action) {
    if (error.message === 'BARBERSHOP_NOT_FOUND') {
        return res.status(404).json({ error: 'Perfil da barbearia não encontrado.', code: 'BARBERSHOP_NOT_FOUND' })
    }
    if (error.message === 'SERVICE_NOT_FOUND') {
        return res.status(404).json({ error: 'Serviço não encontrado.', code: 'SERVICE_NOT_FOUND' })
    }
    return res.status(500).json({ error: `Não foi possível ${action} o serviço.`, code: 'SERVICE_ACTION_FAILED' })
}

function invalidId(res) {
    return res.status(400).json({ error: 'Identificador inválido.', code: 'INVALID_ID' })
}

export async function getServices(req, res) {
    try {
        const data = await listServices(req.accessToken, req.user.id)
        return res.status(200).json({ services: data })
    } catch (error) {
        return handleServiceError(error, res, 'buscar')
    }
}

export async function createService(req, res) {
    const validation = validateServicePayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' })

    try {
        const data = await createServiceRecord(validation.payload, req.accessToken, req.user.id)

        return res.status(201).json({ service: data })
    } catch (error) {
        return handleServiceError(error, res, 'cadastrar')
    }
}

export async function updateService(req, res) {
    if (!isUuid(req.params.id)) return invalidId(res)
    const validation = validateServicePayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' })

    try {
        const data = await updateServiceRecord(req.params.id, validation.payload, req.accessToken, req.user.id)

        return res.status(200).json({ service: data })
    } catch (error) {
        return handleServiceError(error, res, 'atualizar')
    }
}

export async function deleteService(req, res) {
    if (!isUuid(req.params.id)) return invalidId(res)
    try {
        await deleteServiceRecord(req.params.id, req.accessToken, req.user.id)
        return res.status(204).send()
    } catch (error) {
        return handleServiceError(error, res, 'excluir')
    }
}

export default { getServices, createService, updateService, deleteService }
