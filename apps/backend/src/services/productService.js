import { createUserClient } from '../config/supabase.js'
import { getBarbershopIdForAuthenticatedUser } from './barbershopService.js'
import { fromCents } from './money.js'
import { DEFAULT_PAGINATION } from '../validation/shared.js'

const MOVEMENTS_TABLE = 'inventory_movements'
const SALES_TABLE = 'sales'
const PAYMENTS_TABLE = 'payments'
const REFUNDS_TABLE = 'payment_refunds'
const EXPENSES_TABLE = 'expenses'
const MOVEMENT_COLUMNS = 'id, product_id, movement_type, direction, quantity, reason, note, sale_id, refund_id, created_by, created_at'
const SALE_COLUMNS = 'id, sold_at, payment_method, status, total_amount'
const FINANCE_PAYMENT_COLUMNS = 'id, sale_id, amount, paid_at, method, note, source_type, created_at'
const FINANCE_REFUND_COLUMNS = 'id, payment_id, amount, refunded_at, reason, created_at'
const FINANCE_EXPENSE_COLUMNS = 'id, description, amount, spent_at, note, source_type, inventory_movement_id, created_at'
const TIME_ZONE = 'America/Fortaleza'

const MESSAGE_CODES = [
    ['BARBERSHOP_NOT_FOUND', 'BARBERSHOP_NOT_FOUND'],
    ['PRODUCT_SALE_NOT_FOUND', 'PRODUCT_SALE_NOT_FOUND'],
    ['PRODUCT_INACTIVE', 'PRODUCT_INACTIVE'],
    ['SALE_ALREADY_RETURNED', 'SALE_ALREADY_RETURNED'],
    ['ESTOQUE_INSUFICIENTE', 'ESTOQUE_INSUFICIENTE'],
    ['SALE_ITEMS_INVALID', 'SALE_ITEMS_INVALID'],
    ['REFUND_INVALID', 'REFUND_INVALID'],
    ['PRODUCT_COST_REQUIRED', 'PRODUCT_COST_REQUIRED'],
    ['STOCK_EXPENSE_INVALID', 'STOCK_EXPENSE_INVALID'],
    ['PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND']
]

async function getContext(token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)
    return { supabase, profileId }
}

function pageOrRows(data, count, withCount) {
    return withCount ? { rows: data ?? [], count } : data ?? []
}

function throwRpcError(error, { failed, notFound = 'PRODUCT_NOT_FOUND', duplicate = 'PRODUCT_DUPLICATE', invalid = 'INVALID_PRODUCT_DATA' }) {
    const message = error?.message ?? ''
    for (const [needle, code] of MESSAGE_CODES) {
        if (message.includes(needle)) throw new Error(code, { cause: error })
    }
    if (error?.code === 'P0002' || error?.code === '23503') {
        throw new Error(notFound, { cause: error })
    }
    if (error?.code === '23505') {
        throw new Error(duplicate, { cause: error })
    }
    if (['22023', '23514', '22P02'].includes(error?.code)) {
        throw new Error(invalid, { cause: error })
    }
    throw new Error(failed, { cause: error })
}

export async function listProducts(token, userId) {
    const { supabase } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('products_list_catalog')
    if (error) throw new Error('PRODUCTS_READ_FAILED', { cause: error })
    return data ?? []
}

export async function createProduct(token, userId, payload) {
    const { supabase } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('products_create_product', {
        p_name: payload.name,
        p_description: payload.description,
        p_price: payload.price,
        p_cost: payload.cost,
        p_sku: payload.sku,
        p_low_stock_threshold: payload.lowStockThreshold
    })
    if (error) {
        throwRpcError(error, { failed: 'PRODUCT_CREATE_FAILED' })
    }
    return data
}

export async function updateProduct(token, userId, productId, payload) {
    const { supabase } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('products_update_product', {
        p_id: productId,
        p_name: payload.name,
        p_description: payload.description,
        p_price: payload.price,
        p_cost: payload.cost,
        p_sku: payload.sku,
        p_low_stock_threshold: payload.lowStockThreshold
    })
    if (error) {
        throwRpcError(error, { failed: 'PRODUCT_UPDATE_FAILED' })
    }
    return data
}

export async function setProductActive(token, userId, productId, isActive) {
    const { supabase } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('products_set_active', {
        p_id: productId,
        p_is_active: isActive
    })
    if (error) {
        throwRpcError(error, { failed: 'PRODUCT_UPDATE_FAILED' })
    }
    return data
}

export async function deleteProduct(token, userId, productId) {
    const { supabase } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('products_delete_product', { p_id: productId })
    if (error) {
        throwRpcError(error, {
            failed: 'PRODUCT_DELETE_FAILED',
            duplicate: 'PRODUCT_DELETE_FAILED',
            invalid: 'PRODUCT_DELETE_HAS_HISTORY'
        })
    }
    return data
}

export async function listMovements(token, userId, productId = null, pagination = DEFAULT_PAGINATION, options = {}) {
    const { supabase, profileId } = await getContext(token, userId)
    let query = supabase
        .from(MOVEMENTS_TABLE)
        .select(MOVEMENT_COLUMNS, { count: 'exact' })
        .eq('profile_id', profileId)

    if (productId) query = query.eq('product_id', productId)

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) throw new Error('MOVEMENTS_READ_FAILED', { cause: error })
    return pageOrRows(data, count, options.withCount)
}

export async function recordMovement(token, userId, payload) {
    const { supabase } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('products_record_movement', {
        p_product_id: payload.productId,
        p_movement_type: payload.movementType,
        p_quantity: payload.quantity,
        p_direction: payload.direction,
        p_reason: payload.reason,
        p_note: payload.note
    })
    if (error) {
        throwRpcError(error, { failed: 'MOVEMENT_CREATE_FAILED' })
    }
    return data
}

export async function listSales(token, userId, from, to, pagination = DEFAULT_PAGINATION, options = {}) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error, count } = await supabase
        .from(SALES_TABLE)
        .select(SALE_COLUMNS, { count: 'exact' })
        .eq('profile_id', profileId)
        .gte('sold_at', from)
        .lt('sold_at', to)
        .order('sold_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) throw new Error('SALES_READ_FAILED', { cause: error })
    return pageOrRows(data, count, options.withCount)
}

export async function createSale(token, userId, payload) {
    const { supabase } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('products_create_sale', {
        p_items: payload.items,
        p_payment_method: payload.paymentMethod,
        p_sold_at: payload.soldAt,
        p_idempotency_key: payload.idempotencyKey,
        p_note: payload.note
    })
    if (error) {
        throwRpcError(error, {
            failed: 'SALE_CREATE_FAILED',
            duplicate: 'SALE_IDEMPOTENCY_CONFLICT'
        })
    }
    return data
}

export async function refundSale(token, userId, saleId, payload) {
    const { supabase } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('products_refund_sale', {
        p_sale_id: saleId,
        p_refunded_at: payload.refundedAt,
        p_reason: payload.reason
    })
    if (error) {
        throwRpcError(error, { failed: 'SALE_REFUND_FAILED' })
    }
    return data
}

export async function getProductFinanceOverview(token, userId, from, to, pagination = DEFAULT_PAGINATION) {
    const { supabase, profileId } = await getContext(token, userId)
    const [totalsResult, salesResult, paymentsResult, purchasesResult] = await Promise.all([
        supabase.rpc('products_finance_period_totals', {
            p_profile_id: profileId,
            p_from: from,
            p_to: to
        }),
        supabase
            .from(SALES_TABLE)
            .select(SALE_COLUMNS)
            .eq('profile_id', profileId)
            .gte('sold_at', from)
            .lt('sold_at', to)
            .order('sold_at', { ascending: false })
            .range(pagination.offset, pagination.offset + pagination.limit - 1),
        supabase
            .from(PAYMENTS_TABLE)
            .select(FINANCE_PAYMENT_COLUMNS)
            .eq('profile_id', profileId)
            .eq('source_type', 'product_sale')
            .gte('paid_at', from)
            .lt('paid_at', to)
            .order('paid_at', { ascending: false })
            .range(pagination.offset, pagination.offset + pagination.limit - 1),
        supabase
            .from(EXPENSES_TABLE)
            .select(FINANCE_EXPENSE_COLUMNS)
            .eq('profile_id', profileId)
            .eq('source_type', 'stock_entry')
            .gte('spent_at', from)
            .lt('spent_at', to)
            .order('spent_at', { ascending: false })
            .range(pagination.offset, pagination.offset + pagination.limit - 1)
    ])

    for (const result of [totalsResult, salesResult, paymentsResult, purchasesResult]) {
        if (result.error) throw new Error('PRODUCT_FINANCE_READ_FAILED', { cause: result.error })
    }

    const totals = totalsResult.data ?? {}
    const sales = salesResult.data ?? []
    const payments = paymentsResult.data ?? []
    const purchases = purchasesResult.data ?? []
    let refunds = []

    if (payments.length > 0) {
        const refundsResult = await supabase
            .from(REFUNDS_TABLE)
            .select(FINANCE_REFUND_COLUMNS)
            .eq('profile_id', profileId)
            .in('payment_id', payments.map((payment) => payment.id))
            .gte('refunded_at', from)
            .lt('refunded_at', to)
            .order('refunded_at', { ascending: false })
            .range(pagination.offset, pagination.offset + pagination.limit - 1)

        if (refundsResult.error) {
            throw new Error('PRODUCT_FINANCE_READ_FAILED', { cause: refundsResult.error })
        }
        refunds = refundsResult.data ?? []
    }

    const grossCents = Number(totals.gross_revenue_cents ?? 0)
    const refundsCents = Number(totals.refunds_cents ?? 0)
    const purchasesCents = Number(totals.purchase_expenses_cents ?? 0)
    const netCents = grossCents - refundsCents

    return {
        period: { from, to, timeZone: TIME_ZONE },
        currency: 'BRL',
        summary: {
            grossRevenue: fromCents(grossCents),
            refunds: fromCents(refundsCents),
            netRevenue: fromCents(netCents),
            purchaseExpenses: fromCents(purchasesCents),
            balance: fromCents(netCents - purchasesCents),
            salesCount: Number(totals.sales_count ?? 0),
            paymentsCount: Number(totals.payments_count ?? 0),
            refundsCount: Number(totals.refunds_count ?? 0),
            purchasesCount: Number(totals.purchases_count ?? 0)
        },
        sales,
        payments,
        refunds,
        purchases
    }
}
