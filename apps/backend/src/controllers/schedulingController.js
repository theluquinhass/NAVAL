import {
    createPublicAppointment,
    createPrivateAppointment,
    getPublicBookingData,
    getWorkingHours,
    listAppointments,
    saveWorkingHours
} from '../services/schedulingService.js'
import { createUserClient } from '../config/supabase.js'
import { validateAppointmentPayload } from '../validation/appointmentValidation.js'
import { validateWorkingHoursRows } from '../validation/workingHoursValidation.js'
import { isStrictCalendarDate, isStrictIsoDateTime, isUuid, validatePagination } from '../validation/shared.js'

function internalError(res, error) {
    const message = error.message
    console.error(`[scheduling] ${message}`, error.cause?.code ?? '', error.cause?.message ?? '')
    if (message === 'BARBERSHOP_NOT_FOUND' || message === 'SERVICE_NOT_FOUND') {
        return res.status(404).json({ error: 'Barbearia ou serviço não encontrado.', code: message })
    }
    if (message === 'SLOT_UNAVAILABLE' || message === 'SLOT_TAKEN') {
        return res.status(409).json({ error: 'Esse horário não está mais disponível.', code: message })
    }
    const databaseCode = error.cause?.code ?? error.code
    if (databaseCode === '22007' || databaseCode === '22023') {
        return res.status(400).json({
            error: 'Os dados informados para o agendamento são inválidos.',
            code: 'INVALID_APPOINTMENT_DATA'
        })
    }
    return res.status(500).json({ error: 'Não foi possível concluir a operação.', code: 'SCHEDULING_ACTION_FAILED' })
}

function validationError(res, error) {
    return res.status(400).json({ error, code: 'VALIDATION_ERROR' })
}

export async function getWorkingHoursController(req, res) {
    try {
        return res.status(200).json({ workingHours: await getWorkingHours(req.accessToken, req.user.id) })
    } catch (error) {
        return internalError(res, error)
    }
}

export async function putWorkingHoursController(req, res) {
    const rows = req.body?.workingHours
    const validation = validateWorkingHoursRows(rows)
    if (validation.error) return validationError(res, validation.error)
    if (req.body?.confirmConflicts !== undefined && typeof req.body.confirmConflicts !== 'boolean') {
        return validationError(res, 'Confirmação de conflitos inválida.')
    }
    try {
        const workingHours = await saveWorkingHours(
            req.accessToken,
            req.user.id,
            validation.rows,
            { confirmConflicts: req.body?.confirmConflicts === true }
        )
        return res.status(200).json({ workingHours })
    } catch (error) {
        if (error.message === 'WORKING_HOURS_CONFLICTS') {
            return res.status(409).json({
                code: error.message,
                error: 'Há agendamentos confirmados fora dos novos períodos. Eles não serão alterados.',
                conflicts: error.conflicts,
                totalConflicts: error.totalConflicts
            })
        }
        return internalError(res, error)
    }
}

export async function getAppointmentsController(req, res) {
    const { from, to } = req.query
    if (!isStrictIsoDateTime(from) || !isStrictIsoDateTime(to) || Date.parse(from) >= Date.parse(to)) {
        return validationError(res, 'Informe um intervalo de datas válido.')
    }
    const paginationValidation = validatePagination(req.query)
    if (paginationValidation.error) return validationError(res, paginationValidation.error)

    try {
        const result = await listAppointments(
            req.accessToken, req.user.id, from, to, paginationValidation.pagination, { withCount: true }
        )
        const rows = Array.isArray(result) ? result : result?.rows ?? []
        const count = Array.isArray(result) ? result.length : result?.count
        if (typeof count === 'number') res.setHeader('X-Total-Count', String(count))
        return res.status(200).json({ appointments: rows })
    } catch (error) {
        return internalError(res, error)
    }
}

export async function postPrivateAppointmentController(req, res) {
    const validation = validateAppointmentPayload(req.body)
    if (validation.error) return validationError(res, validation.error)

    try {
        const supabase = createUserClient(req.accessToken)
        const appointment = await createPrivateAppointment(supabase, req.user.id, validation.payload)
        return res.status(201).json({ appointment })
    } catch (error) {
        return internalError(res, error)
    }
}

export async function getPublicAvailabilityController(req, res) {
    const { date } = req.query
    // An empty serviceId (e.g. an unselected <select>) means "no service yet":
    // the catalog must still load so the customer can pick one.
    const serviceId = req.query.serviceId === '' ? undefined : req.query.serviceId
    if (!isStrictCalendarDate(date)) {
        return validationError(res, 'Informe uma data válida.')
    }
    if (serviceId !== undefined && !isUuid(serviceId)) {
        return validationError(res, 'Informe um serviço válido.')
    }
    try {
        const data = await getPublicBookingData(req.params.slug, date, serviceId)
        return res.status(200).json(data)
    } catch (error) {
        return internalError(res, error)
    }
}

export async function postPublicAppointmentController(req, res) {
    const validation = validateAppointmentPayload(req.body)
    if (validation.error) return validationError(res, validation.error)

    try {
        const appointment = await createPublicAppointment(req.params.slug, validation.payload)
        return res.status(201).json({ appointment })
    } catch (error) {
        return internalError(res, error)
    }
}

export default {
    getWorkingHoursController,
    putWorkingHoursController,
    getAppointmentsController,
    postPrivateAppointmentController,
    getPublicAvailabilityController,
    postPublicAppointmentController
}
