import {
    createPublicAppointment,
    getPublicBookingData,
    getWorkingHours,
    listAppointments,
    saveWorkingHours
} from '../services/schedulingService.js'

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
    if (!Array.isArray(rows) || rows.some((row) =>
        !Number.isInteger(row.day_of_week) || row.day_of_week < 0 || row.day_of_week > 6 ||
        typeof row.opens_at !== 'string' || typeof row.closes_at !== 'string' ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.opens_at) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.closes_at) || row.opens_at >= row.closes_at
    ) || new Set(rows.map((row) => row.day_of_week)).size !== rows.length) {
        return res.status(400).json({ error: 'Informe horários válidos e únicos para cada dia.' })
    }
    try {
        return res.status(200).json({ workingHours: await saveWorkingHours(req.accessToken, req.user.id, rows) })
    } catch (error) {
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
    getPublicAvailabilityController,
    postPublicAppointmentController
}
