import { createUserClient } from '../config/supabase.js'
import { findProfileForUser } from '../services/barbershopService.js'
import { listAppointments } from '../services/schedulingService.js'
import { getFinanceSummary } from '../services/financeService.js'
import { validatePeriod } from '../validation/financeValidation.js'

export async function getDashboardOverviewController(req, res) {
    const validation = validatePeriod(req.query)
    if (validation.error) return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' })

    const supabase = createUserClient(req.accessToken)
    const { from, to } = validation.period

    const [profileResult, appointmentsResult, financeResult] = await Promise.allSettled([
        findProfileForUser(supabase, req.user.id),
        listAppointments(req.accessToken, req.user.id, from, to),
        getFinanceSummary(req.accessToken, req.user.id, from, to)
    ])

    if (appointmentsResult.status === 'rejected') {
        console.error('[dashboard] appointments', appointmentsResult.reason?.message ?? '')
        return res.status(500).json({ error: 'Não foi possível carregar a agenda de hoje.', code: 'DASHBOARD_APPOINTMENTS_FAILED' })
    }

    if (profileResult.status === 'rejected') {
        console.error('[dashboard] profile', profileResult.reason?.message ?? '')
    }
    const financeDegraded = financeResult.status === 'rejected'
    if (financeDegraded) {
        console.error('[dashboard] finance', financeResult.reason?.message ?? '')
    }

    return res.status(200).json({
        profile: profileResult.status === 'fulfilled' ? profileResult.value.data : null,
        appointments: appointmentsResult.value,
        financeSummary: financeDegraded ? null : financeResult.value,
        ...(financeDegraded ? { degraded: true } : {})
    })
}

export default { getDashboardOverviewController }
