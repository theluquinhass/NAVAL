import { createUserClient } from '../config/supabase.js'
import { getBarbershopIdForAuthenticatedUser } from './barbershopService.js'
import { listSales } from './productService.js'

const CATEGORIES_TABLE = 'expense_categories'
const PAYMENTS_TABLE = 'payments'
const REFUNDS_TABLE = 'payment_refunds'
const EXPENSES_TABLE = 'expenses'
const TIME_ZONE = 'America/Fortaleza'

function toCents(value) {
    return Math.round(Number(value) * 100)
}

function fromCents(cents) {
    return Number((cents / 100).toFixed(2))
}

function sumCents(rows, column) {
    return rows.reduce((total, row) => total + toCents(row[column]), 0)
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
    const [paymentsResult, refundsResult, expensesResult] = await Promise.all([
        supabase
            .from(PAYMENTS_TABLE)
            .select('id, amount, paid_at')
            .eq('profile_id', profileId)
            .gte('paid_at', from)
            .lt('paid_at', to),
        supabase
            .from(REFUNDS_TABLE)
            .select('id, amount, refunded_at')
            .eq('profile_id', profileId)
            .gte('refunded_at', from)
            .lt('refunded_at', to),
        supabase
            .from(EXPENSES_TABLE)
            .select('id, amount, spent_at')
            .eq('profile_id', profileId)
            .gte('spent_at', from)
            .lt('spent_at', to)
    ])

    for (const result of [paymentsResult, refundsResult, expensesResult]) {
        if (result.error) throw new Error('FINANCE_SUMMARY_FAILED', { cause: result.error })
    }

    const payments = paymentsResult.data ?? []
    const refunds = refundsResult.data ?? []
    const expenses = expensesResult.data ?? []
    const revenueCents = sumCents(payments, 'amount')
    const refundsCents = sumCents(refunds, 'amount')
    const expensesCents = sumCents(expenses, 'amount')
    const netRevenueCents = revenueCents - refundsCents

    return {
        period: { from, to, timeZone: TIME_ZONE },
        currency: 'BRL',
        revenue: fromCents(revenueCents),
        refunds: fromCents(refundsCents),
        netRevenue: fromCents(netRevenueCents),
        expenses: fromCents(expensesCents),
        balance: fromCents(netRevenueCents - expensesCents),
        paymentsCount: payments.length,
        refundsCount: refunds.length,
        expensesCount: expenses.length
    }
}

export async function listPayments(token, userId, from, to) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(PAYMENTS_TABLE)
        .select('id, appointment_id, amount, paid_at, method, note, source_type, sale_id, created_at')
        .eq('profile_id', profileId)
        .gte('paid_at', from)
        .lt('paid_at', to)
        .order('paid_at', { ascending: false })
        .limit(500)

    if (error) throw new Error('PAYMENTS_READ_FAILED', { cause: error })
    return data ?? []
}

export async function createPayment(token, userId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(PAYMENTS_TABLE)
        .insert({
            profile_id: profileId,
            appointment_id: payload.appointmentId,
            amount: payload.amount,
            paid_at: payload.paidAt,
            method: payload.method,
            note: payload.note
        })
        .select('id, appointment_id, amount, paid_at, method, note, created_at')
        .single()

    if (error) {
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
    const { data, error } = await supabase
        .from(REFUNDS_TABLE)
        .insert({
            profile_id: profileId,
            payment_id: payload.paymentId,
            amount: payload.amount,
            refunded_at: payload.refundedAt,
            reason: payload.reason
        })
        .select('id, payment_id, amount, refunded_at, reason, created_at')
        .single()

    if (error) {
        throwDatabaseError(error, {
            notFound: 'PAYMENT_NOT_FOUND',
            invalid: 'REFUND_INVALID',
            failed: 'REFUND_CREATE_FAILED'
        })
    }
    return data
}

export async function listExpenses(token, userId, from, to) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(EXPENSES_TABLE)
        .select('id, category_id, description, amount, spent_at, payment_method, note, created_at')
        .eq('profile_id', profileId)
        .gte('spent_at', from)
        .lt('spent_at', to)
        .order('spent_at', { ascending: false })
        .limit(500)

    if (error) throw new Error('EXPENSES_READ_FAILED', { cause: error })
    return data ?? []
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

const EXPENSE_COLUMNS = 'id, category_id, description, amount, spent_at, payment_method, note, created_at, updated_at'

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
        throwDatabaseError(error, {
            notFound: 'CATEGORY_NOT_FOUND',
            invalid: 'INVALID_FINANCE_DATA',
            failed: 'EXPENSE_UPDATE_FAILED'
        })
    }
    if (!data) throw new Error('EXPENSE_NOT_FOUND')
    return data
}

export async function listCategories(token, userId) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(CATEGORIES_TABLE)
        .select('id, name, is_active, created_at, updated_at')
        .eq('profile_id', profileId)
        .order('name')
        .limit(200)

    if (error) throw new Error('CATEGORIES_READ_FAILED', { cause: error })
    return data ?? []
}

export async function createCategory(token, userId, payload) {
    const { supabase, profileId } = await getContext(token, userId)
    const { data, error } = await supabase
        .from(CATEGORIES_TABLE)
        .insert({ profile_id: profileId, name: payload.name, is_active: payload.isActive })
        .select('id, name, is_active, created_at, updated_at')
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
        .select('id, name, is_active, created_at, updated_at')
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
