import { createUserClient } from '../config/supabase.js'
import { getBarbershopIdForAuthenticatedUser } from './barbershopService.js'
import { listSales } from './productService.js'
import { fromCents } from './money.js'
import { DEFAULT_PAGINATION } from '../validation/shared.js'

const CATEGORIES_TABLE = 'expense_categories'
const PAYMENTS_TABLE = 'payments'
const REFUNDS_TABLE = 'payment_refunds'
const EXPENSES_TABLE = 'expenses'
const TIME_ZONE = 'America/Fortaleza'

const PAYMENT_COLUMNS = 'id, appointment_id, amount, paid_at, method, note, created_at'
const REFUND_COLUMNS = 'id, payment_id, amount, refunded_at, reason, created_at'
const EXPENSE_COLUMNS = 'id, category_id, description, amount, spent_at, payment_method, note, source_type, inventory_movement_id, created_at, updated_at'
const CATEGORY_COLUMNS = 'id, name, is_active, created_at, updated_at'

function pageOrRows(data, count, withCount) {
    return withCount ? { rows: data ?? [], count } : data ?? []
}

async function getContext(token, userId) {
    const supabase = createUserClient(token)
    const profileId = await getBarbershopIdForAuthenticatedUser(supabase, userId)
    return { supabase, profileId }
}

function throwDatabaseError(error, { notFound, duplicate, invalid, failed }) {
    if (error?.code === '23503' && notFound) throw new Error(notFound, { cause: error })
    if (error?.code === '23505' && duplicate) throw new Error(duplicate, { cause: error })
    if ((error?.code === '22023' || error?.code === '23514') && invalid) {
        throw new Error(invalid, { cause: error })
    }
    throw new Error(failed, { cause: error })
}

async function findIdempotentRecord(supabase, table, profileId, idempotencyKey, columns) {
    if (!idempotencyKey) return null
    const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq('profile_id', profileId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

    if (error) throw new Error('IDEMPOTENCY_LOOKUP_FAILED', { cause: error })
    return data ?? null
}

export async function getFinanceOverview(token, userId, from, to) {
    const [summary, payments, expenses, categories, sales] = await Promise.all([
        getFinanceSummary(token, userId, from, to),
        listPayments(token, userId, from, to),
        listExpenses(token, userId, from, to),
        listCategories(token, userId),
        listSales(token, userId, from, to)
    ])
    return { summary, payments, expenses, categories, sales }
}

export async function getFinanceSummary(token, userId, from, to) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase.rpc('finance_period_totals', {
        p_profile_id: profileId,
        p_from: from,
        p_to: to
    })

    if (error) throw new Error('FINANCE_SUMMARY_FAILED', { cause: error })

    const totals = data ?? {}
    const revenueCents = Number(totals.revenue_cents ?? 0)
    const refundsCents = Number(totals.refunds_cents ?? 0)
    const expensesCents = Number(totals.expense_cents ?? 0)
    const netRevenueCents = revenueCents - refundsCents

    return {
        period: { from, to, timeZone: TIME_ZONE },
        currency: 'BRL',
        revenue: fromCents(revenueCents),
        refunds: fromCents(refundsCents),
        netRevenue: fromCents(netRevenueCents),
        expenses: fromCents(expensesCents),
        balance: fromCents(netRevenueCents - expensesCents),
        paymentsCount: Number(totals.payments_count ?? 0),
        refundsCount: Number(totals.refunds_count ?? 0),
        expensesCount: Number(totals.expenses_count ?? 0)
    }
}

export async function listPayments(token, userId, from, to, pagination = DEFAULT_PAGINATION, options = {}) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error, count } = await supabase
        .from(PAYMENTS_TABLE)
        .select('id, appointment_id, amount, paid_at, method, note, source_type, sale_id, created_at', { count: 'exact' })
        .eq('profile_id', profileId)
        .gte('paid_at', from)
        .lt('paid_at', to)
        .order('paid_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) throw new Error('PAYMENTS_READ_FAILED', { cause: error })
    return pageOrRows(data, count, options.withCount)
}

export async function createPayment(token, userId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const existing = await findIdempotentRecord(supabase, PAYMENTS_TABLE, profileId, payload.idempotencyKey, PAYMENT_COLUMNS)
    if (existing) return existing

    const { data, error } = await supabase
        .from(PAYMENTS_TABLE)
        .insert({
            profile_id: profileId,
            appointment_id: payload.appointmentId,
            amount: payload.amount,
            paid_at: payload.paidAt,
            method: payload.method,
            note: payload.note,
            idempotency_key: payload.idempotencyKey ?? null
        })
        .select(PAYMENT_COLUMNS)
        .single()

    if (error) {
        if (error?.code === '23505' && payload.idempotencyKey) {
            const original = await findIdempotentRecord(supabase, PAYMENTS_TABLE, profileId, payload.idempotencyKey, PAYMENT_COLUMNS)
            if (original) return original
        }
        throwDatabaseError(error, {
            notFound: 'APPOINTMENT_NOT_FOUND',
            invalid: 'INVALID_FINANCE_LINK',
            failed: 'PAYMENT_CREATE_FAILED'
        })
    }
    return data
}

export async function createRefund(token, userId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const existing = await findIdempotentRecord(supabase, REFUNDS_TABLE, profileId, payload.idempotencyKey, REFUND_COLUMNS)
    if (existing) return existing

    const { data, error } = await supabase
        .from(REFUNDS_TABLE)
        .insert({
            profile_id: profileId,
            payment_id: payload.paymentId,
            amount: payload.amount,
            refunded_at: payload.refundedAt,
            reason: payload.reason,
            idempotency_key: payload.idempotencyKey ?? null
        })
        .select(REFUND_COLUMNS)
        .single()

    if (error) {
        if (error?.code === '23505' && payload.idempotencyKey) {
            const original = await findIdempotentRecord(supabase, REFUNDS_TABLE, profileId, payload.idempotencyKey, REFUND_COLUMNS)
            if (original) return original
        }
        throwDatabaseError(error, {
            notFound: 'PAYMENT_NOT_FOUND',
            invalid: 'REFUND_INVALID',
            failed: 'REFUND_CREATE_FAILED'
        })
    }
    return data
}

export async function listExpenses(token, userId, from, to, pagination = DEFAULT_PAGINATION, options = {}) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error, count } = await supabase
        .from(EXPENSES_TABLE)
        .select(EXPENSE_COLUMNS, { count: 'exact' })
        .eq('profile_id', profileId)
        .gte('spent_at', from)
        .lt('spent_at', to)
        .order('spent_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) throw new Error('EXPENSES_READ_FAILED', { cause: error })
    return pageOrRows(data, count, options.withCount)
}

function expenseRecord(payload, profileId) {
    return {
        profile_id: profileId,
        category_id: payload.categoryId,
        description: payload.description,
        amount: payload.amount,
        spent_at: payload.spentAt,
        payment_method: payload.paymentMethod,
        note: payload.note
    }
}

export async function createExpense(token, userId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(EXPENSES_TABLE)
        .insert(expenseRecord(payload, profileId))
        .select(EXPENSE_COLUMNS)
        .single()

    if (error) {
        throwDatabaseError(error, {
            notFound: 'CATEGORY_NOT_FOUND',
            invalid: 'INVALID_FINANCE_DATA',
            failed: 'EXPENSE_CREATE_FAILED'
        })
    }
    return data
}

export async function updateExpense(token, userId, expenseId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(EXPENSES_TABLE)
        .update(expenseRecord(payload, profileId))
        .eq('id', expenseId)
        .eq('profile_id', profileId)
        .select(EXPENSE_COLUMNS)
        .maybeSingle()

    if (error) {
        if (error?.code === '22023') throw new Error('STOCK_EXPENSE_CONFLICT', { cause: error })
        throwDatabaseError(error, {
            notFound: 'CATEGORY_NOT_FOUND',
            invalid: 'INVALID_FINANCE_DATA',
            failed: 'EXPENSE_UPDATE_FAILED'
        })
    }
    if (!data) throw new Error('EXPENSE_NOT_FOUND')
    return data
}

export async function listCategories(token, userId, pagination = DEFAULT_PAGINATION, options = {}) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error, count } = await supabase
        .from(CATEGORIES_TABLE)
        .select(CATEGORY_COLUMNS, { count: 'exact' })
        .eq('profile_id', profileId)
        .order('name')
        .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) throw new Error('CATEGORIES_READ_FAILED', { cause: error })
    return pageOrRows(data, count, options.withCount)
}

export async function createCategory(token, userId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(CATEGORIES_TABLE)
        .insert({ profile_id: profileId, name: payload.name, is_active: payload.isActive })
        .select(CATEGORY_COLUMNS)
        .single()

    if (error) {
        throwDatabaseError(error, {
            duplicate: 'CATEGORY_DUPLICATE',
            invalid: 'INVALID_FINANCE_DATA',
            failed: 'CATEGORY_CREATE_FAILED'
        })
    }
    return data
}

export async function updateCategory(token, userId, categoryId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(CATEGORIES_TABLE)
        .update({ name: payload.name, is_active: payload.isActive })
        .eq('id', categoryId)
        .eq('profile_id', profileId)
        .select(CATEGORY_COLUMNS)
        .maybeSingle()

    if (error) {
        throwDatabaseError(error, {
            duplicate: 'CATEGORY_DUPLICATE',
            invalid: 'INVALID_FINANCE_DATA',
            failed: 'CATEGORY_UPDATE_FAILED'
        })
    }
    if (!data) throw new Error('CATEGORY_NOT_FOUND')
    return data
}

export async function deleteCategory(token, userId, categoryId) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(CATEGORIES_TABLE)
        .delete()
        .eq('id', categoryId)
        .eq('profile_id', profileId)
        .select('id')
        .maybeSingle()

    if (error) throw new Error('CATEGORY_DELETE_FAILED', { cause: error })
    if (!data) throw new Error('CATEGORY_NOT_FOUND')
    return data
}
