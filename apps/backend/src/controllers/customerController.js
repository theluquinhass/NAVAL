import {
    createCustomer as createCustomerRecord,
    getCustomer as getCustomerRecord,
    getCustomerAppointments,
    listCustomers,
    updateCustomer as updateCustomerRecord
} from '../services/customerService.js'
import {
    validateCustomerId,
    validateCustomerPayload,
    validateCustomerSearch
} from '../validation/customerValidation.js'
import { validatePagination } from '../validation/shared.js'

function handleCustomerError(error, res, action) {
    if (error.message === 'BARBERSHOP_NOT_FOUND') {
        return res.status(404).json({ error: 'Perfil da barbearia não encontrado.', code: 'BARBERSHOP_NOT_FOUND' })
    }
    if (error.message === 'CUSTOMER_NOT_FOUND') {
        return res.status(404).json({ error: 'Cliente não encontrado.', code: 'CUSTOMER_NOT_FOUND' })
    }
    if (error.message === 'CUSTOMER_DUPLICATE') {
        return res.status(409).json({ error: 'Já existe um cliente com esse telefone nesta barbearia.', code: 'CUSTOMER_DUPLICATE' })
    }

    console.error(`[customers] ${error.message}`, error.cause?.code ?? '', error.cause?.message ?? '')
    return res.status(500).json({ error: `Não foi possível ${action} os clientes.`, code: 'CUSTOMER_ACTION_FAILED' })
}

function validationError(res, error) {
    return res.status(400).json({ error, code: 'VALIDATION_ERROR' })
}

export async function getCustomersController(req, res) {
    const searchValidation = validateCustomerSearch(req.query.search)
    if (searchValidation.error) return validationError(res, searchValidation.error)
    const paginationValidation = validatePagination(req.query)
    if (paginationValidation.error) return validationError(res, paginationValidation.error)

    try {
        const result = await listCustomers(
            req.accessToken, req.user.id, searchValidation.search, paginationValidation.pagination, { withCount: true }
        )
        const rows = Array.isArray(result) ? result : result?.rows ?? []
        const count = Array.isArray(result) ? result.length : result?.count
        if (typeof count === 'number') res.setHeader('X-Total-Count', String(count))
        return res.status(200).json({ customers: rows })
    } catch (error) {
        return handleCustomerError(error, res, 'buscar')
    }
}

export async function postCustomerController(req, res) {
    const validation = validateCustomerPayload(req.body)
    if (validation.error) return validationError(res, validation.error)

    try {
        const customer = await createCustomerRecord(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ customer })
    } catch (error) {
        return handleCustomerError(error, res, 'cadastrar')
    }
}

export async function putCustomerController(req, res) {
    if (!validateCustomerId(req.params.id)) {
        return validationError(res, 'Identificador de cliente inválido.')
    }
    const validation = validateCustomerPayload(req.body)
    if (validation.error) return validationError(res, validation.error)

    try {
        const customer = await updateCustomerRecord(req.accessToken, req.user.id, req.params.id, validation.payload)
        return res.status(200).json({ customer })
    } catch (error) {
        return handleCustomerError(error, res, 'atualizar')
    }
}

export async function getCustomerDetailsController(req, res) {
    if (!validateCustomerId(req.params.id)) {
        return validationError(res, 'Identificador de cliente inválido.')
    }

    try {
        const [customer, appointments] = await Promise.all([
            getCustomerRecord(req.accessToken, req.user.id, req.params.id),
            getCustomerAppointments(req.accessToken, req.user.id, req.params.id)
        ])
        return res.status(200).json({ customer, appointments })
    } catch (error) {
        return handleCustomerError(error, res, 'buscar')
    }
}

export default {
    getCustomersController,
    postCustomerController,
    putCustomerController,
    getCustomerDetailsController
}
