import api from './api.js'

function params(from, to) {
    return { params: { from, to } }
}

export async function getFinanceSummary(from, to) {
    return (await api.get('/finance/summary', params(from, to))).data.summary
}

export async function listPayments(from, to) {
    return (await api.get('/finance/payments', params(from, to))).data.payments
}

export async function createPayment(payload) {
    return (await api.post('/finance/payments', payload)).data.payment
}

export async function createRefund(payload) {
    return (await api.post('/finance/refunds', payload)).data.refund
}

export async function listExpenses(from, to) {
    return (await api.get('/finance/expenses', params(from, to))).data.expenses
}

export async function createExpense(payload) {
    return (await api.post('/finance/expenses', payload)).data.expense
}

export async function updateExpense(id, payload) {
    return (await api.put(`/finance/expenses/${encodeURIComponent(id)}`, payload)).data.expense
}

export async function listCategories() {
    return (await api.get('/finance/categories')).data.categories
}

export async function createCategory(payload) {
    return (await api.post('/finance/categories', payload)).data.category
}

export async function updateCategory(id, payload) {
    return (await api.put(`/finance/categories/${encodeURIComponent(id)}`, payload)).data.category
}

export async function deleteCategory(id) {
    await api.delete(`/finance/categories/${encodeURIComponent(id)}`)
}
