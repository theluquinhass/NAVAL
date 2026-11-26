import { useCallback, useEffect, useMemo, useState } from 'react'
import { createRefund } from '../../../../services/financeApi.js'
import {
    createSale,
    getProductFinanceOverview,
    listProducts,
    refundSale
} from '../../../../services/productsApi.js'
import {
    fortalezaInputValue,
    fortalezaToday,
    formatDateTime,
    formatMoney,
    getErrorMessage,
    moneyToCents,
    newIdempotencyKey,
    periodBounds,
    toFortalezaIso
} from '../../../../utils/dashboard.js'
import '../../management.css'
import '../../Finance/finance.css'
import '../products.css'

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/

function validAmount(value) {
    return MONEY_PATTERN.test(String(value)) && Number(value) > 0
}

function Metric({ label, value, detail, tone }) {
    return (
        <article className={`finance-metric${tone ? ` finance-metric--${tone}` : ''}`}>
            <span className="finance-metric__label">{label}</span>
            <strong className="finance-metric__value">{formatMoney(value)}</strong>
            {detail && <span className="finance-metric__detail">{detail}</span>}
        </article>
    )
}

function SaleForm({ products, productsError, onCancel, onSaved }) {
    const availableProducts = useMemo(
        () => products.filter((product) => product.is_active && product.stock > 0),
        [products]
    )
    const [items, setItems] = useState(() => [{
        productId: availableProducts[0]?.id ?? '',
        quantity: '1'
    }])
    const [form, setForm] = useState({ paymentMethod: 'Pix', soldAt: fortalezaInputValue(), note: '' })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const idempotencyKey = useMemo(() => newIdempotencyKey(), [])

    const total = useMemo(() => items.reduce((sum, item) => {
        const product = products.find((entry) => entry.id === item.productId)
        const quantity = Number(item.quantity)
        return sum + (product && Number.isFinite(quantity) ? Number(product.price) * quantity : 0)
    }, 0), [items, products])

    function changeForm(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setError('')
    }

    function changeItem(index, field, value) {
        setItems((current) => current.map((item, itemIndex) => (
            itemIndex === index ? { ...item, [field]: value } : item
        )))
        setError('')
    }

    function addItem() {
        if (items.length >= availableProducts.length) return
        setItems((current) => [...current, { productId: '', quantity: '1' }])
    }

    function removeItem(index) {
        setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
        setError('')
    }

    async function submit(event) {
        event.preventDefault()
        if (availableProducts.length === 0) {
            setError('Não há produtos ativos com estoque disponível.')
            return
        }
        if (!form.soldAt) {
            setError('Informe quando a venda ocorreu.')
            return
        }

        const selectedIds = new Set()
        for (const item of items) {
            if (!item.productId) {
                setError('Selecione um produto em cada linha.')
                return
            }
            if (selectedIds.has(item.productId)) {
                setError('Não repita produtos; ajuste a quantidade na linha existente.')
                return
            }
            if (!/^\d+$/.test(String(item.quantity)) || Number(item.quantity) < 1) {
                setError('Informe quantidades inteiras maiores que zero.')
                return
            }
            const product = products.find((entry) => entry.id === item.productId)
            if (!product || product.stock < Number(item.quantity)) {
                setError(`Estoque insuficiente para ${product?.name ?? 'o produto selecionado'}.`)
                return
            }
            selectedIds.add(item.productId)
        }

        setSaving(true)
        setError('')
        try {
            await createSale({
                items: items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
                paymentMethod: form.paymentMethod.trim(),
                soldAt: toFortalezaIso(form.soldAt),
                note: form.note.trim() || null,
                idempotencyKey
            })
            onSaved('Venda registrada. Receita e estoque atualizados.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível registrar a venda.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel finance-form finance-sale-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>Registrar venda de produto</h2>
                <p>Escolha produtos ativos e quantidades. Preço, custo, total, pagamento e baixa de estoque são calculados no servidor.</p>
            </div>
            {productsError && <p className="finance-form__hint" role="alert">{productsError}</p>}
            {availableProducts.length === 0 ? (
                <p className="dashboard-management__empty">Cadastre produtos com estoque para registrar uma venda.</p>
            ) : (
                <>
                    <div className="finance-sale-items">
                        {items.map((item, index) => (
                            <div className="finance-sale-item" key={index}>
                                <label className="dashboard-management__field" htmlFor={`sale-product-${index}`}>Produto
                                    <select id={`sale-product-${index}`} value={item.productId} onChange={(event) => changeItem(index, 'productId', event.target.value)} required>
                                        <option value="">Selecione</option>
                                        {availableProducts.map((product) => (
                                            <option
                                                key={product.id}
                                                value={product.id}
                                                disabled={items.some((other, otherIndex) => otherIndex !== index && other.productId === product.id)}
                                            >
                                                {product.name} · {formatMoney(product.price)} · {product.stock} un.
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="dashboard-management__field" htmlFor={`sale-quantity-${index}`}>Quantidade
                                    <input id={`sale-quantity-${index}`} name="quantity" type="number" min="1" required value={item.quantity} onChange={(event) => changeItem(index, 'quantity', event.target.value)} />
                                </label>
                                <button className="dashboard-management__secondary" type="button" onClick={() => removeItem(index)} disabled={items.length === 1 || saving}>Remover</button>
                            </div>
                        ))}
                    </div>
                    <button className="dashboard-management__secondary" type="button" onClick={addItem} disabled={items.length >= availableProducts.length || saving}>Adicionar produto</button>
                    <label className="dashboard-management__field" htmlFor="sale-method">Forma de pagamento
                        <input id="sale-method" name="paymentMethod" type="text" maxLength={50} required value={form.paymentMethod} onChange={changeForm} />
                    </label>
                    <label className="dashboard-management__field" htmlFor="sale-date">Vendido em (Fortaleza)
                        <input id="sale-date" name="soldAt" type="datetime-local" required value={form.soldAt} onChange={changeForm} />
                    </label>
                    <label className="dashboard-management__field" htmlFor="sale-note">Observação (opcional)
                        <input id="sale-note" name="note" type="text" maxLength={500} value={form.note} onChange={changeForm} />
                    </label>
                    <p className="finance-sale-total">Total calculado no servidor: <strong>{formatMoney(total)}</strong></p>
                    {error && <p role="alert">{error}</p>}
                    <div className="dashboard-management__actions">
                        <button className="dashboard-management__primary" type="submit" disabled={saving}>{saving ? 'Registrando...' : 'Registrar venda'}</button>
                        <button className="dashboard-management__secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
                    </div>
                </>
            )}
        </form>
    )
}

function SaleRefundForm({ payments, refunds, initialPaymentId, onCancel, onSaved }) {
    const refundedCentsByPayment = useMemo(() => refunds.reduce((totals, refund) => {
        totals[refund.payment_id] = (totals[refund.payment_id] ?? 0) + moneyToCents(refund.amount)
        return totals
    }, {}), [refunds])
    const [form, setForm] = useState({
        paymentId: initialPaymentId || payments[0]?.id || '',
        amount: '',
        refundedAt: fortalezaInputValue(),
        reason: ''
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const selectedPayment = payments.find((payment) => payment.id === form.paymentId)
    const remainingCents = selectedPayment
        ? Math.max(0, moneyToCents(selectedPayment.amount) - (refundedCentsByPayment[selectedPayment.id] ?? 0))
        : 0

    function change(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setError('')
    }

    async function submit(event) {
        event.preventDefault()
        if (!form.paymentId) {
            setError('Selecione a venda que está sendo estornada.')
            return
        }
        if (!validAmount(form.amount)) {
            setError('Informe o valor estornado, com até duas casas decimais.')
            return
        }
        if (remainingCents > 0 && moneyToCents(form.amount) > remainingCents) {
            setError(`O valor restante para estorno é ${formatMoney(remainingCents / 100)}.`)
            return
        }

        setSaving(true)
        setError('')
        try {
            await createRefund({
                paymentId: form.paymentId,
                amount: form.amount,
                refundedAt: toFortalezaIso(form.refundedAt),
                reason: form.reason.trim() || null
            })
            onSaved('Estorno financeiro registrado. O estoque não foi alterado.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível registrar o estorno.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel finance-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>Estorno financeiro de venda</h2>
                <p>O pagamento original permanece no histórico. Este estorno não devolve itens ao estoque.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="sale-refund-payment">Venda
                <select id="sale-refund-payment" name="paymentId" required value={form.paymentId} onChange={change}>
                    <option value="">Selecione uma venda</option>
                    {payments.map((payment) => {
                        const remaining = Math.max(0, moneyToCents(payment.amount) - (refundedCentsByPayment[payment.id] ?? 0)) / 100
                        return (
                            <option key={payment.id} value={payment.id}>
                                {formatDateTime(payment.paid_at)} · {formatMoney(payment.amount)} · restante {formatMoney(remaining)}
                            </option>
                        )
                    })}
                </select>
            </label>
            <label className="dashboard-management__field" htmlFor="sale-refund-amount">Valor estornado (R$)
                <input id="sale-refund-amount" name="amount" type="text" inputMode="decimal" required value={form.amount} onChange={change} placeholder="0.00" />
            </label>
            <label className="dashboard-management__field" htmlFor="sale-refund-date">Estornado em (Fortaleza)
                <input id="sale-refund-date" name="refundedAt" type="datetime-local" required value={form.refundedAt} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="sale-refund-reason">Motivo (opcional)
                <input id="sale-refund-reason" name="reason" type="text" maxLength={500} value={form.reason} onChange={change} />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="dashboard-management__actions">
                <button className="dashboard-management__primary" type="submit" disabled={saving}>{saving ? 'Estornando...' : 'Registrar estorno'}</button>
                <button className="dashboard-management__secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
            </div>
        </form>
    )
}

function SalesPanel({ sales, payments, refunds, onFinancialRefund, onChanged, notify }) {
    const [busyId, setBusyId] = useState('')

    async function returnWithStock(sale) {
        const reason = window.prompt('Motivo da devolução com estorno:', 'Devolução do cliente')
        if (reason === null || !reason.trim()) return
        if (!window.confirm('Estornar esta venda e devolver os itens ao estoque?')) return

        setBusyId(sale.id)
        try {
            await refundSale(sale.id, {
                refundedAt: toFortalezaIso(fortalezaInputValue()),
                reason: reason.trim()
            })
            notify('Venda estornada e itens devolvidos ao estoque.')
            onChanged()
        } catch (refundError) {
            notify(getErrorMessage(refundError, 'Não foi possível devolver a venda.'))
        } finally {
            setBusyId('')
        }
    }

    return (
        <section className="dashboard-management__panel" aria-labelledby="product-sales-title">
            <div className="dashboard-management__panel-heading">
                <h2 id="product-sales-title">Vendas de produtos</h2>
                <p>Estorno financeiro isolado não altera o estoque. Use “Devolver com estoque” para devolver os itens fisicamente.</p>
            </div>
            {sales.length === 0 ? (
                <p className="dashboard-management__empty">Nenhuma venda de produto registrada neste período.</p>
            ) : (
                <ul className="finance-list">
                    {sales.map((sale) => {
                        const payment = payments.find((entry) => entry.sale_id === sale.id)
                        const saleRefunds = refunds.filter((refund) => refund.payment_id === payment?.id)
                        return (
                            <li key={sale.id}>
                                <div className="finance-list__copy">
                                    <strong>{formatDateTime(sale.sold_at)}</strong>
                                    <span>
                                        {sale.payment_method}
                                        {sale.status === 'refunded' ? ' · devolvida' : ''}
                                        {saleRefunds.length > 0 ? ` · ${saleRefunds.length} estorno(s)` : ''}
                                    </span>
                                </div>
                                <span className="finance-list__amount">{formatMoney(sale.total_amount)}</span>
                                <div className="products-finance-actions">
                                    {payment && (
                                        <button className="dashboard-management__secondary" type="button" onClick={() => onFinancialRefund(payment.id)}>
                                            Estorno financeiro
                                        </button>
                                    )}
                                    <button
                                        className="dashboard-management__secondary"
                                        type="button"
                                        disabled={sale.status === 'refunded' || busyId === sale.id}
                                        onClick={() => returnWithStock(sale)}
                                    >
                                        {busyId === sale.id ? 'Processando...' : 'Devolver com estoque'}
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}

function PurchasesPanel({ purchases }) {
    return (
        <section className="dashboard-management__panel" aria-labelledby="product-purchases-title">
            <div className="dashboard-management__panel-heading">
                <h2 id="product-purchases-title">Compras de estoque</h2>
                <p>Despesas geradas automaticamente pelas entradas: custo do produto multiplicado pela quantidade.</p>
            </div>
            {purchases.length === 0 ? (
                <p className="dashboard-management__empty">Nenhuma compra de estoque registrada neste período.</p>
            ) : (
                <ul className="finance-list">
                    {purchases.map((purchase) => (
                        <li key={purchase.id}>
                            <div className="finance-list__copy">
                                <strong>{purchase.description}</strong>
                                <span>{formatDateTime(purchase.spent_at)} · compra de estoque</span>
                                {purchase.note && <small>{purchase.note}</small>}
                            </div>
                            <span className="finance-list__amount finance-list__amount--out">{formatMoney(purchase.amount)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

export default function ProductsFinance() {
    const today = useMemo(() => fortalezaToday(), [])
    const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`)
    const [toDate, setToDate] = useState(today)
    const [overview, setOverview] = useState(null)
    const [products, setProducts] = useState([])
    const [productsError, setProductsError] = useState('')
    const [loadedKey, setLoadedKey] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [form, setForm] = useState('')
    const [refundTarget, setRefundTarget] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)

    const { from, to, invalid: periodInvalid } = periodBounds(fromDate, toDate)
    const requestKey = `${from}|${to}|${refreshKey}`
    const loading = !periodInvalid && loadedKey !== requestKey

    const refresh = useCallback(() => setRefreshKey((current) => current + 1), [])

    useEffect(() => {
        if (periodInvalid) return undefined

        let active = true
        Promise.all([
            getProductFinanceOverview(from, to),
            listProducts()
        ])
            .then(([nextOverview, nextProducts]) => {
                if (!active) return
                setOverview(nextOverview)
                setProducts(nextProducts)
                setProductsError('')
                setError('')
                setLoadedKey(requestKey)
            })
            .catch((loadError) => {
                if (!active) return
                setError(getErrorMessage(loadError, 'Não foi possível carregar o financeiro dos produtos.'))
                setLoadedKey(requestKey)
            })

        return () => { active = false }
    }, [from, to, periodInvalid, requestKey])

    function notify(text) {
        setMessage(text)
    }

    function saved(text) {
        notify(text)
        setForm('')
        setRefundTarget('')
        refresh()
    }

    function openFinancialRefund(paymentId) {
        setRefundTarget(paymentId)
        setForm('refund')
    }

    const summary = overview?.summary
    const sales = overview?.sales ?? []
    const payments = overview?.payments ?? []
    const refunds = overview?.refunds ?? []
    const purchases = overview?.purchases ?? []

    return (
        <main className="dashboard-management finance-page">
            <header className="dashboard-management__header finance-page__header">
                <div>
                    <p className="dashboard-eyebrow">Produtos</p>
                    <h1>Financeiro de produtos</h1>
                    <p>Vendas, estornos e compras de estoque. Pagamentos de venda continuam contando na receita geral sem criar outra fonte de receita.</p>
                </div>
            </header>

            <section className="dashboard-management__panel finance-period" aria-labelledby="product-finance-period-title">
                <div className="finance-period__heading">
                    <h2 id="product-finance-period-title">Período</h2>
                    <span>Fuso: America/Fortaleza</span>
                </div>
                <div className="finance-period__fields">
                    <label className="dashboard-management__field" htmlFor="product-finance-from">De
                        <input id="product-finance-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                    </label>
                    <label className="dashboard-management__field" htmlFor="product-finance-to">Até
                        <input id="product-finance-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                    </label>
                    <p className="finance-period__note">O último dia é incluído integralmente. Vendas contam pela data da venda; pagamentos e compras, pelas datas de recebimento e pagamento.</p>
                </div>
            </section>

            {periodInvalid && <p className="finance-error" role="alert">A data inicial deve ser anterior ou igual à final.</p>}
            {message && <p className="dashboard-management__notice" role="status">{message}</p>}

            {periodInvalid ? null : loading ? (
                <p className="dashboard-management__empty" role="status">Carregando o financeiro dos produtos...</p>
            ) : error ? (
                <div className="dashboard-management__empty">
                    <p role="alert">{error}</p>
                    <button className="dashboard-management__secondary" type="button" onClick={refresh}>Tentar novamente</button>
                </div>
            ) : (
                <>
                    <section className="finance-metrics products-finance-metrics" aria-label="Resumo do período">
                        <Metric label="Receita bruta" value={summary?.grossRevenue} detail={summary ? `${summary.salesCount} venda(s)` : ''} />
                        <Metric label="Estornos" value={summary?.refunds} detail={summary ? `${summary.refundsCount} estorno(s)` : ''} tone="danger" />
                        <Metric label="Receita líquida" value={summary?.netRevenue} detail={summary ? `${summary.paymentsCount} pagamento(s)` : ''} />
                        <Metric label="Compras de estoque" value={summary?.purchaseExpenses} detail={summary ? `${summary.purchasesCount} compra(s)` : ''} tone="danger" />
                        <Metric label="Saldo" value={summary?.balance} tone="success" />
                    </section>

                    <div className="finance-actions">
                        <button className="dashboard-management__primary" type="button" onClick={() => { setRefundTarget(''); setForm('sale') }}>Registrar venda</button>
                        <button className="dashboard-management__secondary" type="button" onClick={() => { setRefundTarget(''); setForm('refund') }} disabled={payments.length === 0}>Registrar estorno financeiro</button>
                    </div>

                    {form === 'sale' && (
                        <SaleForm
                            products={products}
                            productsError={productsError}
                            onCancel={() => setForm('')}
                            onSaved={saved}
                        />
                    )}
                    {form === 'refund' && (
                        <SaleRefundForm
                            key={refundTarget || 'any'}
                            payments={payments}
                            refunds={refunds}
                            initialPaymentId={refundTarget}
                            onCancel={() => { setForm(''); setRefundTarget('') }}
                            onSaved={saved}
                        />
                    )}

                    <div className="finance-grid">
                        <SalesPanel
                            sales={sales}
                            payments={payments}
                            refunds={refunds}
                            onFinancialRefund={openFinancialRefund}
                            onChanged={refresh}
                            notify={notify}
                        />
                        <PurchasesPanel purchases={purchases} />
                    </div>
                </>
            )}
        </main>
    )
}
