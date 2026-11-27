import api from './api.js'

export async function listProducts() {
    return (await api.get('/products')).data.products
}

export async function createProduct(payload) {
    return (await api.post('/products', payload)).data.product
}

export async function updateProduct(id, payload) {
    return (await api.put(`/products/${id}`, payload)).data.product
}

export async function setProductActive(id, isActive) {
    return (await api.patch(`/products/${id}/active`, { isActive })).data.product
}

export async function deleteProduct(id) {
    await api.delete(`/products/${id}`)
}

export async function listMovements(productId) {
    const params = productId ? { params: { productId } } : undefined
    return (await api.get('/products/movements', params)).data.movements
}

export async function recordMovement(payload) {
    return (await api.post('/products/movements', payload)).data.movement
}

export async function listSales(from, to) {
    return (await api.get('/products/sales', { params: { from, to } })).data.sales
}

export async function getProductFinanceOverview(from, to) {
    return (await api.get('/products/finance/overview', { params: { from, to } })).data
}

export async function createSale(payload) {
    return (await api.post('/products/sales', payload)).data
}

export async function refundSale(id, payload) {
    return (await api.post(`/products/sales/${id}/refund`, payload)).data
}
