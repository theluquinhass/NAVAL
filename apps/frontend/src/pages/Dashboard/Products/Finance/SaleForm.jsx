import { useMemo, useState } from 'react'
import { createSale } from '../../../../services/productsApi.js'
import {
    fortalezaInputValue,
    formatMoney,
    getErrorMessage,
    newIdempotencyKey,
    toFortalezaIso
} from '../../../../utils/dashboard.js'

let saleRowSequence = 0

function newSaleRow(productId = '') {
    saleRowSequence += 1
    return { rowId: `sale-row-${saleRowSequence}`, productId, quantity: '1' }
}

export default function SaleForm({ products, productsError, onCancel, onSaved }) {
    const availableProducts = useMemo(
        () => products.filter((product) => product.is_active && product.stock > 0),
        [products]
    )
    const [items, setItems] = useState(() => [newSaleRow(availableProducts[0]?.id ?? '')])
    const [form, setForm] = useState({ paymentMethod: 'Pix', soldAt: fortalezaInputValue(), note: '' })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    // useState (not useMemo) so the key is guaranteed stable across retries of the same sale.
    const [idempotencyKey] = useState(() => newIdempotencyKey())

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

    function changeItem(rowId, field, value) {
        setItems((current) => current.map((item) => (
            item.rowId === rowId ? { ...item, [field]: value } : item
        )))
        setError('')
    }

    function addItem() {
        if (items.length >= availableProducts.length) return
        setItems((current) => [...current, newSaleRow()])
    }

    function removeItem(rowId) {
        setItems((current) => current.filter((item) => item.rowId !== rowId))
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
                        {items.map((item) => (
                            <div className="finance-sale-item" key={item.rowId}>
                                <label className="dashboard-management__field" htmlFor={`${item.rowId}-product`}>Produto
                                    <select id={`${item.rowId}-product`} value={item.productId} onChange={(event) => changeItem(item.rowId, 'productId', event.target.value)} required>
                                        <option value="">Selecione</option>
                                        {availableProducts.map((product) => (
                                            <option
                                                key={product.id}
                                                value={product.id}
                                                disabled={items.some((other) => other.rowId !== item.rowId && other.productId === product.id)}
                                            >
                                                {product.name} · {formatMoney(product.price)} · {product.stock} un.
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="dashboard-management__field" htmlFor={`${item.rowId}-quantity`}>Quantidade
                                    <input id={`${item.rowId}-quantity`} name="quantity" type="number" min="1" required value={item.quantity} onChange={(event) => changeItem(item.rowId, 'quantity', event.target.value)} />
                                </label>
                                <button className="dashboard-management__secondary" type="button" onClick={() => removeItem(item.rowId)} disabled={items.length === 1 || saving}>Remover</button>
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
