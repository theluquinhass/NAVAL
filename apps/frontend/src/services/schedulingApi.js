import api from './api.js'

export async function getWorkingHours() {
    return (await api.get('/working-hours')).data.workingHours
}

export async function saveWorkingHours(workingHours, options = {}) {
    return (await api.put('/working-hours', { workingHours, confirmConflicts: options.confirmConflicts === true })).data.workingHours
}

export async function getAppointments(from, to) {
    return (await api.get('/appointments', { params: { from, to } })).data.appointments
}

export async function createPrivateAppointment(payload) {
    return (await api.post('/appointments', payload)).data.appointment
}

export async function getPublicAvailability(slug, date, serviceId) {
    // Without a selected service the endpoint still returns the catalog; never send an empty id.
    const params = serviceId ? { date, serviceId } : { date }
    return (await api.get(`/booking/${encodeURIComponent(slug)}/availability`, { params, skipAuth: true })).data
}

export async function createAppointment(slug, payload) {
    return (await api.post(`/booking/${encodeURIComponent(slug)}/appointments`, payload, { skipAuth: true })).data.appointment
}
