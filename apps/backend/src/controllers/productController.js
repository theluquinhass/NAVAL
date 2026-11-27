import {
    createProduct,
    createSale,
    deleteProduct,
    getProductFinanceOverview,
    listMovements,
    listProducts,
    listSales,
    recordMovement,
    refundSale,
    setProductActive,
    updateProduct
} from '../services/productService.js'
import {
    validateMovementPayload,
    validateMovementProductFilter,
    validateProductActivePayload,
    validateProductId,
    validateProductPayload,
    validateSalePayload,
    validateSalePeriod,
    validateSaleRefundPayload
} from '../validation/productValidation.js'
import { validatePeriod as validateFinancePeriod } from '../validation/financeValidation.js'
import { validatePagination } from '../validation/shared.js'

const NOT_FOUND_CODES = new Set([
    'BARBERSHOP_NOT_FOUND',
    'PRODUCT_NOT_FOUND',
    'PRODUCT_SALE_NOT_FOUND'
])
const CONFLICT_CODES = new Set([
    'PRODUCT_DUPLICATE',
    'PRODUCT_INACTIVE',
    'PRODUCT_DELETE_HAS_HISTORY',
    'ESTOQUE_INSUFICIENTE',
    'SALE_ALREADY_RETURNED',
    'REFUND_INVALID',
    'SALE_IDEMPOTENCY_CONFLICT'
])
const CONFLICT_CODE_MAP = {
    PRODUCT_DUPLICATE: 'PRODUCT_DUPLICATE',
    PRODUCT_INACTIVE: 'INVALID_STATE',
    PRODUCT_DELETE_HAS_HISTORY: 'INVALID_STATE',
    ESTOQUE_INSUFICIENTE: 'INSUFFICIENT_STOCK',
    SALE_ALREADY_RETURNED: 'INVALID_STATE',
    REFUND_INVALID: 'INVALID_STATE',
    SALE_IDEMPOTENCY_CONFLICT: 'SALE_IDEMPOTENCY_CONFLICT'
}
const CONFLICT_MESSAGES = {
    SALE_IDEMPOTENCY_CONFLICT: 'Esta venda já foi registrada com a mesma chave de idempotência.',
    ESTOQUE_INSUFICIENTE: 'Estoque insuficiente para esta operação.',
    PRODUCT_DUPLICATE: 'Já existe um produto com estes dados.'
}
const INVALID_CODES = new Set([
    'INVALID_PRODUCT_DATA',
    'SALE_ITEMS_INVALID',
    'PRODUCT_COST_REQUIRED',
    'STOCK_EXPENSE_INVALID'
])

const INVALID_MESSAGES = {
    PRODUCT_COST_REQUIRED: 'Cadastre um custo maior que zero no produto antes de registrar uma entrada de estoque.',
    STOCK_EXPENSE_INVALID: 'O valor da despesa dessa entrada excede o limite permitido.'
}

function handleProductError(error, res, action) {
    const message = error.message
    if (NOT_FOUND_CODES.has(message)) {
        return res.status(404).json({ error: 'Produto ou venda não encontrada.', code: message })
    }
    if (CONFLICT_CODES.has(message)) {
        return res.status(409).json({
            error: CONFLICT_MESSAGES[message] ?? 'Operação não permitida para o estado atual do estoque ou da venda.',
            code: CONFLICT_CODE_MAP[message]
        })
    }
    if (INVALID_CODES.has(message)) {
        return res.status(400).json({
            error: INVALID_MESSAGES[message] ?? 'Dados de produto, estoque ou venda inválidos.',
            code: message
        })
    }

    console.error(`[products] ${message}`, error.cause?.code ?? '', error.cause?.message ?? '')
    return res.status(500).json({ error: `Não foi possível ${action}.`, code: 'PRODUCT_ACTION_FAILED' })
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

export async function getProductsController(req, res) {
    try {
        const products = await listProducts(req.accessToken, req.user.id)
        return res.status(200).json({ products })
    } catch (error) {
        return handleProductError(error, res, 'buscar os produtos')
    }
}

export async function postProductController(req, res) {
    const validation = validateProductPayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const product = await createProduct(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ product })
    } catch (error) {
        return handleProductError(error, res, 'cadastrar o produto')
    }
}

export async function putProductController(req, res) {
    if (!validateProductId(req.params.id)) return invalidId(res)
    const validation = validateProductPayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const product = await updateProduct(req.accessToken, req.user.id, req.params.id, validation.payload)
        return res.status(200).json({ product })
    } catch (error) {
        return handleProductError(error, res, 'atualizar o produto')
    }
}

export async function patchProductActiveController(req, res) {
    if (!validateProductId(req.params.id)) return invalidId(res)
    const validation = validateProductActivePayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const product = await setProductActive(req.accessToken, req.user.id, req.params.id, validation.payload.isActive)
        return res.status(200).json({ product })
    } catch (error) {
        return handleProductError(error, res, 'atualizar o produto')
    }
}

export async function deleteProductController(req, res) {
    if (!validateProductId(req.params.id)) return invalidId(res)

    try {
        await deleteProduct(req.accessToken, req.user.id, req.params.id)
        return res.status(204).send()
    } catch (error) {
        return handleProductError(error, res, 'excluir o produto')
    }
}

export async function getMovementsController(req, res) {
    const validation = validateMovementProductFilter(req.query)
    if (validation.error) return validationError(res, validation)
    const pagination = paginationFrom(req.query, res)
    if (!pagination) return undefined

    try {
        const result = pageResult(await listMovements(
            req.accessToken, req.user.id, validation.productId, pagination, { withCount: true }
        ))
        setTotalCount(res, result.count)
        return res.status(200).json({ movements: result.rows })
    } catch (error) {
        return handleProductError(error, res, 'buscar as movimentações')
    }
}

export async function postMovementController(req, res) {
    const validation = validateMovementPayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const movement = await recordMovement(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json({ movement })
    } catch (error) {
        return handleProductError(error, res, 'registrar a movimentação')
    }
}

export async function getSalesController(req, res) {
    const validation = validateSalePeriod(req.query)
    if (validation.error) return validationError(res, validation)
    const pagination = paginationFrom(req.query, res)
    if (!pagination) return undefined

    try {
        const result = pageResult(await listSales(
            req.accessToken, req.user.id, validation.period.from, validation.period.to, pagination, { withCount: true }
        ))
        setTotalCount(res, result.count)
        return res.status(200).json({ sales: result.rows })
    } catch (error) {
        return handleProductError(error, res, 'buscar as vendas')
    }
}

export async function getProductFinanceOverviewController(req, res) {
    const validation = validateFinancePeriod(req.query)
    if (validation.error) return validationError(res, validation)
    const pagination = paginationFrom(req.query, res)
    if (!pagination) return undefined

    try {
        const overview = await getProductFinanceOverview(
            req.accessToken,
            req.user.id,
            validation.period.from,
            validation.period.to,
            pagination
        )
        return res.status(200).json(overview)
    } catch (error) {
        return handleProductError(error, res, 'buscar o financeiro dos produtos')
    }
}

export async function postSaleController(req, res) {
    const validation = validateSalePayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const result = await createSale(req.accessToken, req.user.id, validation.payload)
        return res.status(201).json(result)
    } catch (error) {
        return handleProductError(error, res, 'registrar a venda')
    }
}

export async function postSaleRefundController(req, res) {
    if (!validateProductId(req.params.id)) return invalidId(res)
    const validation = validateSaleRefundPayload(req.body)
    if (validation.error) return validationError(res, validation)

    try {
        const result = await refundSale(req.accessToken, req.user.id, req.params.id, validation.payload)
        return res.status(201).json(result)
    } catch (error) {
        return handleProductError(error, res, 'devolver a venda')
    }
}

export default {
    getProductsController,
    postProductController,
    putProductController,
    patchProductActiveController,
    deleteProductController,
    getMovementsController,
    postMovementController,
    getSalesController,
    getProductFinanceOverviewController,
    postSaleController,
    postSaleRefundController
}
