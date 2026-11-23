import api from './api.js'

export async function getWorkingHours() {
    return (await api.get('/working-hours')).data.workingHours
}

export async function saveWorkingHours(workingHours) {
    return (await api.put('/working-hours', { workingHours })).data.workingHours
}

export async function getAppointments(from, to) {
    return (await api.get('/appointments', { params: { from, to } })).data.appointments
}

export async function getPublicAvailability(slug, date, serviceId) {
    return (await api.get(`/booking/${encodeURIComponent(slug)}/availability`, { params: { date, serviceId }, skipAuth: true })).data
}

export async function createAppointment(slug, payload) {
    return (await api.post(`/booking/${encodeURIComponent(slug)}/appointments`, payload, { skipAuth: true })).data.appointment
}
