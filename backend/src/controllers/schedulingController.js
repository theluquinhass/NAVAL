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

function internalError(res, error) {
    const message = error.message
    console.error(`[scheduling] ${message}`, error.cause?.code ?? '', error.cause?.message ?? '')
    if (message === 'BARBERSHOP_NOT_FOUND' || message === 'SERVICE_NOT_FOUND') {
        return res.status(404).json({ error: 'Barbearia ou serviço não encontrado.' })
    }
    if (message === 'SLOT_UNAVAILABLE' || message === 'SLOT_TAKEN') {
        return res.status(409).json({ error: 'Esse horário não está mais disponível.' })
    }
    return res.status(500).json({ error: 'Não foi possível concluir a operação.' })
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
    if (validation.error) return res.status(400).json({ error: validation.error })
    if (req.body?.confirmConflicts !== undefined && typeof req.body.confirmConflicts !== 'boolean') {
        return res.status(400).json({ error: 'Confirmação de conflitos inválida.' })
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
    if (!from || !to || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) {
        return res.status(400).json({ error: 'Informe um intervalo de datas válido.' })
    }
    try {
        const appointments = await listAppointments(req.accessToken, req.user.id, from, to)
        return res.status(200).json({ appointments })
    } catch (error) {
        return internalError(res, error)
    }
}

export async function postPrivateAppointmentController(req, res) {
    const validation = validateAppointmentPayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })

    try {
        const supabase = createUserClient(req.accessToken)
        const appointment = await createPrivateAppointment(supabase, req.user.id, validation.payload)
        return res.status(201).json({ appointment })
    } catch (error) {
        return internalError(res, error)
    }
}

export async function getPublicAvailabilityController(req, res) {
    const { date, serviceId } = req.query
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
        return res.status(400).json({ error: 'Informe uma data válida.' })
    }
    try {
        const data = await getPublicBookingData(req.params.slug, date, serviceId)
        return res.status(200).json(data)
    } catch (error) {
        return internalError(res, error)
    }
}

export async function postPublicAppointmentController(req, res) {
    const { customerName, customerPhone, serviceId, startsAt } = req.body ?? {}
    if (typeof customerName !== 'string' || !customerName.trim() ||
        typeof customerPhone !== 'string' || !customerPhone.trim() ||
        typeof serviceId !== 'string' || !Number.isFinite(Date.parse(startsAt))) {
        return res.status(400).json({ error: 'Nome, telefone, serviço e horário são obrigatórios.' })
    }
    try {
        const appointment = await createPublicAppointment(req.params.slug, { customerName, customerPhone, serviceId, startsAt })
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
