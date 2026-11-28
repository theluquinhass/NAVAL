import { useCallback, useEffect, useMemo, useState } from 'react'
import { getProductFinanceOverview, listProducts } from '../../../../services/productsApi.js'
import { fortalezaToday, getErrorMessage, periodBounds } from '../../../../utils/dashboard.js'
import Metric from '../../Finance/FinanceMetric.jsx'
import SaleForm from './SaleForm.jsx'
import SaleRefundForm from './SaleRefundForm.jsx'
import SalesPanel from './SalesPanel.jsx'
import PurchasesPanel from './PurchasesPanel.jsx'
import '../../management.css'
import '../../Finance/finance.css'
import '../products.css'

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
                    <h1>Vendas e compras</h1>
                    <p>Registre vendas de produtos, devoluções e compras de estoque. O dinheiro das vendas também entra no resumo do Financeiro.</p>
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
