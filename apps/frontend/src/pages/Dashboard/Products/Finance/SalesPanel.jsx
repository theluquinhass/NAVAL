import { useState } from 'react'
import { refundSale } from '../../../../services/productsApi.js'
import {
    fortalezaInputValue,
    formatDateTime,
    formatMoney,
    getErrorMessage,
    toFortalezaIso
} from '../../../../utils/dashboard.js'

export default function SalesPanel({ sales, payments, refunds, onFinancialRefund, onChanged, notify }) {
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
