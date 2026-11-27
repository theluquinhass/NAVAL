import api from './api.js'

export async function listCustomers(search = '') {
    return (await api.get('/customers', { params: search ? { search } : {} })).data.customers
}

export async function createCustomer(payload) {
    return (await api.post('/customers', payload)).data.customer
}

export async function updateCustomer(id, payload) {
    return (await api.put(`/customers/${encodeURIComponent(id)}`, payload)).data.customer
}

export async function getCustomerDetails(id) {
    return (await api.get(`/customers/${encodeURIComponent(id)}`)).data
}
