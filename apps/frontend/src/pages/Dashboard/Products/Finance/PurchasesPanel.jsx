import { formatDateTime, formatMoney } from '../../../../utils/dashboard.js'

export default function PurchasesPanel({ purchases }) {
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
