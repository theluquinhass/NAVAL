import api from './api.js'

export async function getDashboardOverview(from, to) {
    return (await api.get('/dashboard/overview', { params: { from, to } })).data
}
