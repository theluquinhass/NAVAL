import api from './api.js'

export async function listServices() {
    const response = await api.get('/services')
    return response.data.services
}

export async function createService(payload) {
    const response = await api.post('/services', payload)
    return response.data.service
}

export async function updateService(id, payload) {
    const response = await api.put(`/services/${id}`, payload)
    return response.data.service
}

export async function deleteService(id) {
    await api.delete(`/services/${id}`)
}
