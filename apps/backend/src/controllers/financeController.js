import {
    createCategory,
    createExpense,
    createPayment,
    createRefund,
    deleteCategory,
    getFinanceOverview,
    getFinanceSummary,
    listCategories,
    listExpenses,
    listPayments,
    updateCategory,
    updateExpense
} from '../services/financeService.js'
import {
    validateCategoryPayload,
    validateExpensePayload,
    validateFinanceId,
    validatePaymentPayload,
    validatePeriod,
    validateRefundPayload
} from '../validation/financeValidation.js'
import { validatePagination } from '../validation/shared.js'

const NOT_FOUND_CODES = new Set([
    'APPOINTMENT_NOT_FOUND',
    'PAYMENT_NOT_FOUND',
    'CATEGORY_NOT_FOUND',
    'EXPENSE_NOT_FOUND'
])
const CONFLICT_CODES = new Set([
    'REFUND_INVALID',
    'INVALID_FINANCE_LINK',
    'CATEGORY_DUPLICATE',
    'STOCK_EXPENSE_CONFLICT'
])
const CONFLICT_MESSAGES = {
    STOCK_EXPENSE_CONFLICT: 'Não é possível alterar uma despesa vinculada a uma entrada de estoque.'
}

function handleFinanceError(error, res, action) {
    const message = error.message
    if (message === 'BARBERSHOP_NOT_FOUND') {
        return res.status(404).json({ error: 'Perfil da barbearia não encontrado.', code: message })
    }
    if (NOT_FOUND_CODES.has(message)) {
        return res.status(404).json({ error: 'Registro financeiro não encontrado.', code: message })
    }
    if (CONFLICT_CODES.has(message)) {
        return res.status(409).json({
            error: CONFLICT_MESSAGES[message] ?? 'Operação financeira inválida para os dados atuais.',
            code: message
        })
    }
    if (message === 'INVALID_FINANCE_DATA') {
        return res.status(400).json({ error: 'Dados financeiros inválidos.', code: message })
    }

    console.error(`[finance] ${message}`, error.cause?.code ?? '', error.cause?.message ?? '')
    return res.status(500).json({ error: `Não foi possível ${action} os dados financeiros.`, code: 'FINANCE_ACTION_FAILED' })
}

function invalidId(res) {
    return res.status(400).json({ error: 'Identificador inválido.', code: 'INVALID_ID' })
}

function validationError(res, validation) {
    return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' })
}

function pageResult(result) {
    if (Array.isArray(result)) return { rows: result, count: result.length }
    return { rows: result?.rows ?? [], count: result?.count }
}

function setTotalCount(res, count) {
    if (typeof count === 'number') res.setHeader('X-Total-Count', String(count))
}

function paginationFrom(query, res) {
    const validation = validatePagination(query)
    if (validation.error) {
        validationError(res, validation)
        return null
    }
    return validation.pagination
}

export async function getFinanceOverviewController(req, res) {
    const validation = validatePeriod(req.query)
    if (validation.error) return validationError(res, validation)

    try {
        const { from, to } = validation.period
        const overview = await getFinanceOverview(req.accessToken, req.user.id, from, to)
        return res.status(200).json(overview)
    } catch (error) {
        return handleFinanceError(error, res, 'buscar')
    }
}

export async function getFinanceSummaryController(req, res) {
    const validation = validatePeriod(req.query)
    if (validation.error) return validationError(res, validation)

    try {
        const summary = await getFinanceSummary(req.accessToken, req.user.id, validation.period.from, validation.period.to)
        return res.status(200).json({ summary })
    } catch (error) {
        return handleFinanceError(error, res, 'buscar')
    }
}

export async function getPaymentsController(req, res) {
    const validation = validatePeriod(req.query)
    if (validation.error) return validationError(res, validation)
    const pagination = paginationFrom(req.query, res)
    if (!pagination) return undefined

    try {
        const result = pageResult(await listPayments(
            req.accessToken, req.user.id, validation.period.from, validation.period.to, pagination, { withCount: true }
        ))
        setTotalCount(res, result.count)
        return res.status(200).json({ payments: result.rows })
    } catch (error) {
        return handleFinanceError(error, res, 'buscar pagamentos')
    }
}

export async function postPaymentController(req, res) {
    const validation = validatePaymentPayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const payment = await createPayment(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ payment })
    } catch (error) {
        return handleFinanceError(error, res, 'registrar o pagamento')
    }
}

export async function postRefundController(req, res) {
    const validation = validateRefundPayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const refund = await createRefund(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ refund })
    } catch (error) {
        return handleFinanceError(error, res, 'registrar o estorno')
    }
}

export async function getExpensesController(req, res) {
    const validation = validatePeriod(req.query)
    if (validation.error) return validationError(res, validation)
    const pagination = paginationFrom(req.query, res)
    if (!pagination) return undefined

    try {
        const result = pageResult(await listExpenses(
            req.accessToken, req.user.id, validation.period.from, validation.period.to, pagination, { withCount: true }
        ))
        setTotalCount(res, result.count)
        return res.status(200).json({ expenses: result.rows })
    } catch (error) {
        return handleFinanceError(error, res, 'buscar despesas')
    }
}

export async function postExpenseController(req, res) {
    const validation = validateExpensePayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const expense = await createExpense(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ expense })
    } catch (error) {
        return handleFinanceError(error, res, 'registrar a despesa')
    }
}

export async function putExpenseController(req, res) {
    if (!validateFinanceId(req.params.id)) return invalidId(res)
    const validation = validateExpensePayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const expense = await updateExpense(req.accessToken, req.user.id, req.params.id, validation.payload)
        return res.status(200).json({ expense })
    } catch (error) {
        return handleFinanceError(error, res, 'atualizar a despesa')
    }
}

export async function getCategoriesController(req, res) {
    const pagination = paginationFrom(req.query, res)
    if (!pagination) return undefined

    try {
        const result = pageResult(await listCategories(req.accessToken, req.user.id, pagination, { withCount: true }))
        setTotalCount(res, result.count)
        return res.status(200).json({ categories: result.rows })
    } catch (error) {
        return handleFinanceError(error, res, 'buscar as categorias')
    }
}

export async function postCategoryController(req, res) {
    const validation = validateCategoryPayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const category = await createCategory(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ category })
    } catch (error) {
        return handleFinanceError(error, res, 'cadastrar a categoria')
    }
}

export async function putCategoryController(req, res) {
    if (!validateFinanceId(req.params.id)) return invalidId(res)
    const validation = validateCategoryPayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const category = await updateCategory(req.accessToken, req.user.id, req.params.id, validation.payload)
        return res.status(200).json({ category })
    } catch (error) {
        return handleFinanceError(error, res, 'atualizar a categoria')
    }
}

export async function deleteCategoryController(req, res) {
    if (!validateFinanceId(req.params.id)) return invalidId(res)

    try {
        await deleteCategory(req.accessToken, req.user.id, req.params.id)
        return res.status(204).send()
    } catch (error) {
        return handleFinanceError(error, res, 'excluir a categoria')
    }
}

export default {
    getFinanceOverviewController,
    getFinanceSummaryController,
    getPaymentsController,
    postPaymentController,
    postRefundController,
    getExpensesController,
    postExpenseController,
    putExpenseController,
    getCategoriesController,
    postCategoryController,
    putCategoryController,
    deleteCategoryController
}
