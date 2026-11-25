import {
    createCategory,
    createExpense,
    createPayment,
    createRefund,
    deleteCategory,
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

const NOT_FOUND_CODES = new Set([
    'APPOINTMENT_NOT_FOUND',
    'PAYMENT_NOT_FOUND',
    'CATEGORY_NOT_FOUND',
    'EXPENSE_NOT_FOUND'
])
const CONFLICT_CODES = new Set(['REFUND_INVALID', 'INVALID_FINANCE_LINK', 'CATEGORY_DUPLICATE'])

function handleFinanceError(error, res, action) {
    const message = error.message
    if (message === 'BARBERSHOP_NOT_FOUND') {
        return res.status(404).json({ error: 'Perfil da barbearia não encontrado.' })
    }
    if (NOT_FOUND_CODES.has(message)) {
        return res.status(404).json({ error: 'Registro financeiro não encontrado.' })
    }
    if (CONFLICT_CODES.has(message)) {
        return res.status(409).json({ error: 'Operação financeira inválida para os dados atuais.' })
    }
    if (message === 'INVALID_FINANCE_DATA') {
        return res.status(400).json({ error: 'Dados financeiros inválidos.' })
    }

    console.error(`[finance] ${message}`, error.cause?.code ?? '', error.cause?.message ?? '')
    return res.status(500).json({ error: `Não foi possível ${action} os dados financeiros.` })
}

function invalidId(res) {
    return res.status(400).json({ error: 'Identificador inválido.' })
}

export async function getFinanceSummaryController(req, res) {
    const validation = validatePeriod(req.query)
    if (validation.error) return res.status(400).json({ error: validation.error })

    try {
        const summary = await getFinanceSummary(req.accessToken, req.user.id, validation.period.from, validation.period.to)
        return res.status(200).json({ summary })
    } catch (error) {
        return handleFinanceError(error, res, 'buscar')
    }
}

export async function getPaymentsController(req, res) {
    const validation = validatePeriod(req.query)
    if (validation.error) return res.status(400).json({ error: validation.error })

    try {
        const payments = await listPayments(req.accessToken, req.user.id, validation.period.from, validation.period.to)
        return res.status(200).json({ payments })
    } catch (error) {
        return handleFinanceError(error, res, 'buscar pagamentos')
    }
}

export async function postPaymentController(req, res) {
    const validation = validatePaymentPayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })

    try {
        const payment = await createPayment(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ payment })
    } catch (error) {
        return handleFinanceError(error, res, 'registrar o pagamento')
    }
}

export async function postRefundController(req, res) {
    const validation = validateRefundPayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })

    try {
        const refund = await createRefund(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ refund })
    } catch (error) {
        return handleFinanceError(error, res, 'registrar o estorno')
    }
}

export async function getExpensesController(req, res) {
    const validation = validatePeriod(req.query)
    if (validation.error) return res.status(400).json({ error: validation.error })

    try {
        const expenses = await listExpenses(req.accessToken, req.user.id, validation.period.from, validation.period.to)
        return res.status(200).json({ expenses })
    } catch (error) {
        return handleFinanceError(error, res, 'buscar despesas')
    }
}

export async function postExpenseController(req, res) {
    const validation = validateExpensePayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })

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
    if (validation.error) return res.status(400).json({ error: validation.error })

    try {
        const expense = await updateExpense(req.accessToken, req.user.id, req.params.id, validation.payload)
        return res.status(200).json({ expense })
    } catch (error) {
        return handleFinanceError(error, res, 'atualizar a despesa')
    }
}

export async function getCategoriesController(req, res) {
    try {
        const categories = await listCategories(req.accessToken, req.user.id)
        return res.status(200).json({ categories })
    } catch (error) {
        return handleFinanceError(error, res, 'buscar as categorias')
    }
}

export async function postCategoryController(req, res) {
    const validation = validateCategoryPayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })

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
    if (validation.error) return res.status(400).json({ error: validation.error })

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
