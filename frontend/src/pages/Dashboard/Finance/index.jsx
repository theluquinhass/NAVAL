import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    createCategory,
    createExpense,
    createPayment,
    createRefund,
    deleteCategory,
    getFinanceOverview,
    updateCategory,
    updateExpense
} from '../../../services/financeApi.js'
import { createSale, listProducts, refundSale } from '../../../services/productsApi.js'
import { getAppointments } from '../../../services/schedulingApi.js'
import '../management.css'
import './finance.css'

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/
const TIME_ZONE = 'America/Fortaleza'

function getErrorMessage(error, fallback) {
    if (error.response?.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.'
    return error.response?.data?.error || error.message || fallback
}

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}

function formatDateTime(value) {
    if (!value) return 'Data não informada'
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: TIME_ZONE
    }).format(new Date(value))
}

function fortalezaToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date())
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
    return `${values.year}-${values.month}-${values.day}`
}

function fortalezaInputValue(value = new Date()) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date(value))
    const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

function toFortalezaIso(localDateTime) {
    return localDateTime ? `${localDateTime}:00-03:00` : ''
}

function exclusiveEnd(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ''
    const next = new Date(`${date}T12:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString().slice(0, 10)
}

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

function FormActions({ saving, onCancel, label }) {
    return (
        <div className="dashboard-management__actions">
            <button className="dashboard-management__primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : label}
            </button>
            <button className="dashboard-management__secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
    )
}

function PaymentForm({ appointments, appointmentsError, onCancel, onSaved }) {
    const [form, setForm] = useState({
        appointmentId: '', amount: '', paidAt: fortalezaInputValue(), method: 'Pix', note: ''
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    function change(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setError('')
    }

    async function submit(event) {
        event.preventDefault()
        if (!validAmount(form.amount)) {
            setError('Informe o valor efetivamente recebido, com até duas casas decimais.')
            return
        }
        if (!form.paidAt) {
            setError('Informe quando o pagamento foi recebido.')
            return
        }

        setSaving(true)
        setError('')
        try {
            await createPayment({
                appointmentId: form.appointmentId || null,
                amount: form.amount,
                paidAt: toFortalezaIso(form.paidAt),
                method: form.method.trim(),
                note: form.note.trim() || null
            })
            onSaved('Pagamento registrado.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível registrar o pagamento.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel finance-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>Registrar pagamento</h2>
                <p>O valor é o que foi efetivamente recebido. Vincular a um agendamento é opcional e não altera o status dele.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="payment-amount">Valor recebido (R$)
                <input id="payment-amount" name="amount" type="text" inputMode="decimal" required value={form.amount} onChange={change} placeholder="0,00 use ponto: 25.50" />
            </label>
            <label className="dashboard-management__field" htmlFor="payment-date">Recebido em (Fortaleza)
                <input id="payment-date" name="paidAt" type="datetime-local" required value={form.paidAt} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="payment-method">Forma de pagamento
                <input id="payment-method" name="method" type="text" required maxLength={50} value={form.method} onChange={change} placeholder="Pix, dinheiro, cartão..." />
            </label>
            <label className="dashboard-management__field" htmlFor="payment-appointment">Agendamento (opcional)
                <select id="payment-appointment" name="appointmentId" value={form.appointmentId} onChange={change}>
                    <option value="">Sem agendamento vinculado</option>
                    {appointments.map((appointment) => (
                        <option key={appointment.id} value={appointment.id}>
                            {formatDateTime(appointment.starts_at)} · {appointment.customer_name}
                        </option>
                    ))}
                </select>
            </label>
            {appointmentsError && <p className="finance-form__hint" role="alert">{appointmentsError}</p>}
            <label className="dashboard-management__field" htmlFor="payment-note">Observação (opcional)
                <input id="payment-note" name="note" type="text" maxLength={500} value={form.note} onChange={change} />
            </label>
            {error && <p role="alert">{error}</p>}
            <FormActions saving={saving} onCancel={onCancel} label="Registrar pagamento" />
        </form>
    )
}

function newIdempotencyKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16)
        const value = character === 'x' ? random : (random & 0x3) | 0x8
        return value.toString(16)
    })
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

function SalesPanel({ sales, onChanged, notify }) {
    const [busyId, setBusyId] = useState('')

    async function refund(sale) {
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
        <section className="dashboard-management__panel" aria-labelledby="finance-sales-title">
            <div className="dashboard-management__panel-heading">
                <h2 id="finance-sales-title">Vendas de produtos</h2>
                <p>Estorno financeiro isolado não altera o estoque. Use “Devolver com estoque” para devolver os itens fisicamente.</p>
            </div>
            {sales.length === 0 ? (
                <p className="dashboard-management__empty">Nenhuma venda de produto registrada neste período.</p>
            ) : (
                <ul className="finance-list">
                    {sales.map((sale) => (
                        <li key={sale.id}>
                            <div className="finance-list__copy">
                                <strong>{formatDateTime(sale.sold_at)}</strong>
                                <span>{sale.payment_method}{sale.status === 'refunded' ? ' · devolvida' : ''}</span>
                            </div>
                            <span className="finance-list__amount">{formatMoney(sale.total_amount)}</span>
                            <button className="dashboard-management__secondary" type="button" disabled={sale.status === 'refunded' || busyId === sale.id} onClick={() => refund(sale)}>
                                {busyId === sale.id ? 'Processando...' : 'Devolver com estoque'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

function RefundForm({ payments, initialPaymentId, onCancel, onSaved }) {
    const [form, setForm] = useState({
        paymentId: initialPaymentId || payments[0]?.id || '',
        amount: '',
        refundedAt: fortalezaInputValue(),
        reason: ''
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    function change(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setError('')
    }

    async function submit(event) {
        event.preventDefault()
        if (!form.paymentId) {
            setError('Selecione o pagamento que está sendo estornado.')
            return
        }
        if (!validAmount(form.amount)) {
            setError('Informe o valor estornado, com até duas casas decimais.')
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
            onSaved('Estorno registrado. O pagamento original foi mantido.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível registrar o estorno.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel finance-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>Registrar estorno</h2>
                <p>O estorno é um evento separado: o pagamento original permanece no histórico.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="refund-payment">Pagamento
                <select id="refund-payment" name="paymentId" required value={form.paymentId} onChange={change}>
                    <option value="">Selecione um pagamento</option>
                    {payments.map((payment) => (
                        <option key={payment.id} value={payment.id}>
                            {formatDateTime(payment.paid_at)} · {formatMoney(payment.amount)} · {payment.method}
                        </option>
                    ))}
                </select>
            </label>
            <label className="dashboard-management__field" htmlFor="refund-amount">Valor estornado (R$)
                <input id="refund-amount" name="amount" type="text" inputMode="decimal" required value={form.amount} onChange={change} placeholder="0.00" />
            </label>
            <label className="dashboard-management__field" htmlFor="refund-date">Estornado em (Fortaleza)
                <input id="refund-date" name="refundedAt" type="datetime-local" required value={form.refundedAt} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="refund-reason">Motivo (opcional)
                <input id="refund-reason" name="reason" type="text" maxLength={500} value={form.reason} onChange={change} />
            </label>
            {error && <p role="alert">{error}</p>}
            <FormActions saving={saving} onCancel={onCancel} label="Registrar estorno" />
        </form>
    )
}

function ExpenseForm({ categories, expense, onCancel, onSaved }) {
    const [form, setForm] = useState({
        description: expense?.description ?? '',
        amount: expense?.amount ?? '',
        spentAt: fortalezaInputValue(expense?.spent_at),
        categoryId: expense?.category_id ?? '',
        paymentMethod: expense?.payment_method ?? '',
        note: expense?.note ?? ''
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    function change(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setError('')
    }

    async function submit(event) {
        event.preventDefault()
        if (!form.description.trim()) {
            setError('Informe a descrição da despesa.')
            return
        }
        if (!validAmount(form.amount)) {
            setError('Informe o valor da despesa, com até duas casas decimais.')
            return
        }

        const payload = {
            description: form.description.trim(),
            amount: form.amount,
            spentAt: toFortalezaIso(form.spentAt),
            categoryId: form.categoryId || null,
            paymentMethod: form.paymentMethod.trim() || null,
            note: form.note.trim() || null
        }

        setSaving(true)
        setError('')
        try {
            if (expense) await updateExpense(expense.id, payload)
            else await createExpense(payload)
            onSaved(expense ? 'Despesa atualizada.' : 'Despesa registrada.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível salvar a despesa.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel finance-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>{expense ? 'Editar despesa' : 'Registrar despesa'}</h2>
                <p>Lançamentos manuais, contabilizados pela data em que foram pagos.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="expense-description">Descrição
                <input id="expense-description" name="description" type="text" maxLength={200} required value={form.description} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="expense-amount">Valor (R$)
                <input id="expense-amount" name="amount" type="text" inputMode="decimal" required value={form.amount} onChange={change} placeholder="0.00" />
            </label>
            <label className="dashboard-management__field" htmlFor="expense-date">Pago em (Fortaleza)
                <input id="expense-date" name="spentAt" type="datetime-local" required value={form.spentAt} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="expense-category">Categoria (opcional)
                <select id="expense-category" name="categoryId" value={form.categoryId} onChange={change}>
                    <option value="">Sem categoria</option>
                    {categories.filter((category) => category.is_active || category.id === form.categoryId).map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                </select>
            </label>
            <label className="dashboard-management__field" htmlFor="expense-method">Forma de pagamento (opcional)
                <input id="expense-method" name="paymentMethod" type="text" maxLength={50} value={form.paymentMethod} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="expense-note">Observação (opcional)
                <input id="expense-note" name="note" type="text" maxLength={500} value={form.note} onChange={change} />
            </label>
            {error && <p role="alert">{error}</p>}
            <FormActions saving={saving} onCancel={onCancel} label={expense ? 'Salvar alterações' : 'Registrar despesa'} />
        </form>
    )
}

function CategoryManager({ categories, onChanged, notify }) {
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState('')

    async function add(event) {
        event.preventDefault()
        if (!name.trim()) return
        setError('')
        setBusyId('new')
        try {
            await createCategory({ name: name.trim() })
            setName('')
            notify('Categoria criada.')
            onChanged()
        } catch (addError) {
            setError(getErrorMessage(addError, 'Não foi possível criar a categoria.'))
        } finally {
            setBusyId('')
        }
    }

    async function toggle(category) {
        setBusyId(category.id)
        setError('')
        try {
            await updateCategory(category.id, { name: category.name, isActive: !category.is_active })
            notify('Categoria atualizada.')
            onChanged()
        } catch (toggleError) {
            setError(getErrorMessage(toggleError, 'Não foi possível atualizar a categoria.'))
        } finally {
            setBusyId('')
        }
    }

    async function remove(category) {
        setBusyId(category.id)
        setError('')
        try {
            await deleteCategory(category.id)
            notify('Categoria excluída. Despesas antigas ficaram sem categoria.')
            onChanged()
        } catch (removeError) {
            setError(getErrorMessage(removeError, 'Não foi possível excluir a categoria.'))
        } finally {
            setBusyId('')
        }
    }

    return (
        <section className="dashboard-management__panel finance-categories" aria-labelledby="finance-categories-title">
            <div className="dashboard-management__panel-heading">
                <h2 id="finance-categories-title">Categorias de despesa</h2>
                <p>Edite as categorias usadas nos lançamentos da barbearia.</p>
            </div>
            <form className="finance-categories__form" onSubmit={add}>
                <label className="dashboard-management__field" htmlFor="category-name">Nova categoria
                    <input id="category-name" name="name" type="text" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Insumos" />
                </label>
                <button className="dashboard-management__secondary" type="submit" disabled={busyId === 'new'}>Adicionar</button>
            </form>
            {error && <p role="alert">{error}</p>}
            {categories.length === 0 ? (
                <p className="dashboard-management__empty">Nenhuma categoria cadastrada.</p>
            ) : (
                <ul className="finance-category-list">
                    {categories.map((category) => (
                        <li key={category.id}>
                            <span className={category.is_active ? '' : 'finance-category-list__inactive'}>{category.name}</span>
                            <span className="finance-category-list__actions">
                                <button className="dashboard-management__secondary" type="button" disabled={busyId === category.id} onClick={() => toggle(category)}>
                                    {category.is_active ? 'Desativar' : 'Ativar'}
                                </button>
                                <button className="dashboard-management__danger" type="button" disabled={busyId === category.id} onClick={() => remove(category)}>Excluir</button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

export default function Finance() {
    const today = useMemo(() => fortalezaToday(), [])
    const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`)
    const [toDate, setToDate] = useState(today)
    const [summary, setSummary] = useState(null)
    const [payments, setPayments] = useState([])
    const [expenses, setExpenses] = useState([])
    const [categories, setCategories] = useState([])
    const [sales, setSales] = useState([])
    const [saleProducts, setSaleProducts] = useState([])
    const [saleProductsError, setSaleProductsError] = useState('')
    const [appointments, setAppointments] = useState([])
    const [appointmentsError, setAppointmentsError] = useState('')
    const [loadedKey, setLoadedKey] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [form, setForm] = useState('')
    const [refundTarget, setRefundTarget] = useState('')
    const [editingExpense, setEditingExpense] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)

    const from = `${fromDate}T00:00:00-03:00`
    const to = `${exclusiveEnd(toDate)}T00:00:00-03:00`
    const periodInvalid = !fromDate || !toDate || fromDate > toDate
    const requestKey = `${from}|${to}|${refreshKey}`
    const loading = !periodInvalid && loadedKey !== requestKey
    const categoryName = (id) => categories.find((category) => category.id === id)?.name

    const refresh = useCallback(() => setRefreshKey((current) => current + 1), [])

    useEffect(() => {
        if (periodInvalid) return undefined

        let active = true
        getFinanceOverview(from, to)
            .then((overview) => {
                if (!active) return
                setSummary(overview.summary)
                setPayments(overview.payments)
                setExpenses(overview.expenses)
                setCategories(overview.categories)
                setSales(overview.sales ?? [])
                setError('')
                setLoadedKey(requestKey)
            })
            .catch((loadError) => {
                if (!active) return
                setError(getErrorMessage(loadError, 'Não foi possível carregar o financeiro.'))
                setLoadedKey(requestKey)
            })

        return () => { active = false }
    }, [from, to, periodInvalid, requestKey])

    useEffect(() => {
        if (periodInvalid) return undefined

        let active = true
        getAppointments(from, to)
            .then((result) => {
                if (!active) return
                setAppointments(result)
                setAppointmentsError('')
            })
            .catch((loadError) => {
                if (!active) return
                setAppointments([])
                setAppointmentsError(getErrorMessage(loadError, 'Não foi possível carregar os agendamentos do período.'))
            })

        return () => { active = false }
    }, [from, to, periodInvalid])

    useEffect(() => {
        if (form !== 'sale') return undefined

        let active = true
        listProducts()
            .then((products) => {
                if (!active) return
                setSaleProducts(products)
                setSaleProductsError('')
            })
            .catch((loadError) => {
                if (!active) return
                setSaleProducts([])
                setSaleProductsError(getErrorMessage(loadError, 'Não foi possível carregar os produtos.'))
            })

        return () => { active = false }
    }, [form])

    function notify(text) {
        setMessage(text)
    }

    function saved(text) {
        notify(text)
        setForm('')
        setRefundTarget('')
        setEditingExpense(null)
        refresh()
    }

    function openRefund(paymentId) {
        setRefundTarget(paymentId)
        setEditingExpense(null)
        setForm('refund')
    }

    function openExpense(expense) {
        setEditingExpense(expense)
        setForm('expense')
    }

    return (
        <main className="dashboard-management finance-page">
            <header className="dashboard-management__header finance-page__header">
                <div>
                    <p className="dashboard-eyebrow">Gestão</p>
                    <h1>Financeiro</h1>
                    <p>Pagamentos manuais, vendas de produtos, estornos e despesas. Pagamentos são a única fonte de receita.</p>
                </div>
            </header>

            <section className="dashboard-management__panel finance-period" aria-labelledby="finance-period-title">
                <div className="finance-period__heading">
                    <h2 id="finance-period-title">Período</h2>
                    <span>Fuso: America/Fortaleza</span>
                </div>
                <div className="finance-period__fields">
                    <label className="dashboard-management__field" htmlFor="finance-from">De
                        <input id="finance-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                    </label>
                    <label className="dashboard-management__field" htmlFor="finance-to">Até
                        <input id="finance-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                    </label>
                    <p className="finance-period__note">O último dia é incluído integralmente. Pagamentos contam pela data do recebimento; despesas, pela data do pagamento.</p>
                </div>
            </section>

            {periodInvalid && <p className="finance-error" role="alert">A data inicial deve ser anterior ou igual à final.</p>}
            {message && <p className="dashboard-management__notice" role="status">{message}</p>}

            {periodInvalid ? null : loading ? (
                <p className="dashboard-management__empty" role="status">Carregando dados financeiros...</p>
            ) : error ? (
                <div className="dashboard-management__empty">
                    <p role="alert">{error}</p>
                    <button className="dashboard-management__secondary" type="button" onClick={refresh}>Tentar novamente</button>
                </div>
            ) : (
                <>
                    <section className="finance-metrics" aria-label="Resumo do período">
                        <Metric
                            label="Receita recebida"
                            value={summary?.revenue}
                            detail={summary ? `Receita líquida: ${formatMoney(summary.netRevenue)}` : ''}
                        />
                        <Metric label="Estornos" value={summary?.refunds} detail={summary ? `${summary.refundsCount} estorno(s)` : ''} tone="danger" />
                        <Metric label="Despesas" value={summary?.expenses} detail={summary ? `${summary.expensesCount} lançamento(s)` : ''} tone="danger" />
                        <Metric label="Saldo" value={summary?.balance} detail={summary ? `${summary.paymentsCount} pagamento(s) no período` : ''} tone="success" />
                    </section>

                    <div className="finance-actions">
                        <button className="dashboard-management__primary" type="button" onClick={() => { setEditingExpense(null); setRefundTarget(''); setForm('payment') }}>Registrar pagamento</button>
                        <button className="dashboard-management__secondary" type="button" onClick={() => { setEditingExpense(null); setRefundTarget(''); setSaleProducts([]); setSaleProductsError(''); setForm('sale') }}>Registrar venda</button>
                        <button className="dashboard-management__secondary" type="button" onClick={openRefund} disabled={payments.length === 0}>Registrar estorno</button>
                        <button className="dashboard-management__secondary" type="button" onClick={() => { setEditingExpense(null); setForm('expense') }}>Registrar despesa</button>
                    </div>

                    {form === 'payment' && (
                        <PaymentForm
                            appointments={appointments}
                            appointmentsError={appointmentsError}
                            onCancel={() => setForm('')}
                            onSaved={saved}
                        />
                    )}
                    {form === 'sale' && (
                        saleProductsError ? (
                            <div className="dashboard-management__panel">
                                <p className="finance-form__hint" role="alert">{saleProductsError}</p>
                                <button className="dashboard-management__secondary" type="button" onClick={() => setForm('')}>Cancelar</button>
                            </div>
                        ) : saleProducts.length === 0 ? (
                            <p className="dashboard-management__empty" role="status">Carregando produtos...</p>
                        ) : (
                            <SaleForm
                                products={saleProducts}
                                productsError={saleProductsError}
                                onCancel={() => setForm('')}
                                onSaved={saved}
                            />
                        )
                    )}
                    {form === 'refund' && (
                        <RefundForm
                            key={refundTarget || 'any'}
                            payments={payments}
                            initialPaymentId={refundTarget}
                            onCancel={() => { setForm(''); setRefundTarget('') }}
                            onSaved={saved}
                        />
                    )}
                    {form === 'expense' && (
                        <ExpenseForm
                            key={editingExpense?.id ?? 'new'}
                            categories={categories}
                            expense={editingExpense}
                            onCancel={() => { setForm(''); setEditingExpense(null) }}
                            onSaved={saved}
                        />
                    )}

                    <div className="finance-grid">
                        <section className="dashboard-management__panel" aria-labelledby="finance-payments-title">
                            <div className="dashboard-management__panel-heading">
                                <h2 id="finance-payments-title">Pagamentos</h2>
                                <p>Valores efetivamente recebidos no período.</p>
                            </div>
                            {payments.length === 0 ? (
                                <p className="dashboard-management__empty">Nenhum pagamento registrado neste período. O histórico começa na implantação.</p>
                            ) : (
                                <ul className="finance-list">
                                    {payments.map((payment) => (
                                        <li key={payment.id}>
                                            <div className="finance-list__copy">
                                                <strong>{formatDateTime(payment.paid_at)}</strong>
                                                <span>
                                                    {payment.source_type === 'product_sale' ? 'Venda de produto' : payment.method}
                                                    {payment.appointment_id ? ' · agendamento vinculado' : ''}
                                                </span>
                                                {payment.note && <small>{payment.note}</small>}
                                            </div>
                                            <span className="finance-list__amount">{formatMoney(payment.amount)}</span>
                                            <button className="dashboard-management__secondary" type="button" onClick={() => openRefund(payment.id)}>
                                                {payment.source_type === 'product_sale' ? 'Estorno financeiro' : 'Estornar'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="dashboard-management__panel" aria-labelledby="finance-expenses-title">
                            <div className="dashboard-management__panel-heading">
                                <h2 id="finance-expenses-title">Despesas</h2>
                                <p>Lançamentos manuais pagos no período.</p>
                            </div>
                            {expenses.length === 0 ? (
                                <p className="dashboard-management__empty">Nenhuma despesa registrada neste período.</p>
                            ) : (
                                <ul className="finance-list">
                                    {expenses.map((expense) => (
                                        <li key={expense.id}>
                                            <div className="finance-list__copy">
                                                <strong>{expense.description}</strong>
                                                <span>{formatDateTime(expense.spent_at)}{categoryName(expense.category_id) ? ` · ${categoryName(expense.category_id)}` : ''}</span>
                                                {expense.note && <small>{expense.note}</small>}
                                            </div>
                                            <span className="finance-list__amount finance-list__amount--out">{formatMoney(expense.amount)}</span>
                                            <button className="dashboard-management__secondary" type="button" onClick={() => openExpense(expense)}>Editar</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <SalesPanel sales={sales} onChanged={refresh} notify={notify} />

                    <CategoryManager categories={categories} onChanged={refresh} notify={notify} />
                </>
            )}
        </main>
    )
}
