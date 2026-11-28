import { useCallback, useEffect, useMemo, useState } from 'react'
import { getFinanceOverview } from '../../../services/financeApi.js'
import { getAppointments } from '../../../services/schedulingApi.js'
import {
    fortalezaToday,
    formatDateTime,
    formatMoney,
    getErrorMessage,
    periodBounds
} from '../../../utils/dashboard.js'
import Metric from './FinanceMetric.jsx'
import PaymentForm from './PaymentForm.jsx'
import RefundForm from './RefundForm.jsx'
import ExpenseForm from './ExpenseForm.jsx'
import CategoryManager from './CategoryManager.jsx'
import '../management.css'
import './finance.css'

export default function Finance() {
    const today = useMemo(() => fortalezaToday(), [])
    const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`)
    const [toDate, setToDate] = useState(today)
    const [summary, setSummary] = useState(null)
    const [payments, setPayments] = useState([])
    const [expenses, setExpenses] = useState([])
    const [categories, setCategories] = useState([])
    const [appointments, setAppointments] = useState([])
    const [appointmentsError, setAppointmentsError] = useState('')
    const [loadedKey, setLoadedKey] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [form, setForm] = useState('')
    const [refundTarget, setRefundTarget] = useState('')
    const [editingExpense, setEditingExpense] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)

    const { from, to, invalid: periodInvalid } = periodBounds(fromDate, toDate)
    const requestKey = `${from}|${to}|${refreshKey}`
    const loading = !periodInvalid && loadedKey !== requestKey
    const categoryName = (id) => categories.find((category) => category.id === id)?.name
    const manualPayments = useMemo(
        () => payments.filter((payment) => payment.source_type !== 'product_sale' && !payment.sale_id),
        [payments]
    )

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
                    <p className="dashboard-eyebrow">Barbearia</p>
                    <h1>Financeiro</h1>
                    <p>Registre o que entrou (pagamentos), o que saiu (despesas) e devoluções (estornos). Vendas de produtos são registradas em Produtos → Vendas e compras.</p>
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
                        <button className="dashboard-management__secondary" type="button" onClick={openRefund} disabled={manualPayments.length === 0}>Registrar estorno</button>
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
                    {form === 'refund' && (
                        <RefundForm
                            key={refundTarget || 'any'}
                            payments={manualPayments}
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
                                            {payment.source_type !== 'product_sale' && !payment.sale_id && (
                                                <button className="dashboard-management__secondary" type="button" onClick={() => openRefund(payment.id)}>
                                                    Estornar
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="dashboard-management__panel" aria-labelledby="finance-expenses-title">
                            <div className="dashboard-management__panel-heading">
                                <h2 id="finance-expenses-title">Despesas</h2>
                                <p>Lançamentos manuais gerais. Compras de estoque aparecem como informação e são gerenciadas em Produtos → Vendas e compras.</p>
                            </div>
                            {expenses.length === 0 ? (
                                <p className="dashboard-management__empty">Nenhuma despesa registrada neste período.</p>
                            ) : (
                                <ul className="finance-list">
                                    {expenses.map((expense) => {
                                        const stockPurchase = expense.source_type === 'stock_entry'
                                        return (
                                            <li key={expense.id}>
                                                <div className="finance-list__copy">
                                                    <strong>{expense.description}</strong>
                                                    <span>
                                                        {formatDateTime(expense.spent_at)}
                                                        {stockPurchase ? ' · compra de estoque' : ''}
                                                        {categoryName(expense.category_id) ? ` · ${categoryName(expense.category_id)}` : ''}
                                                    </span>
                                                    {expense.note && <small>{expense.note}</small>}
                                                </div>
                                                <span className="finance-list__amount finance-list__amount--out">{formatMoney(expense.amount)}</span>
                                                {!stockPurchase && (
                                                    <button className="dashboard-management__secondary" type="button" onClick={() => openExpense(expense)}>Editar</button>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>

                    <CategoryManager categories={categories} onChanged={refresh} notify={notify} />
                </>
            )}
        </main>
    )
}
