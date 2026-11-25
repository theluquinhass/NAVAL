import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listMovements, listProducts, recordMovement } from '../../../../services/productsApi.js'
import { formatDateTime, formatMoney, getErrorMessage } from '../../../../utils/dashboard.js'
import '../../management.css'
import '../products.css'

const emptyMovement = { productId: '', movementType: 'entry', quantity: '', direction: '1', reason: '', note: '' }
const MOVEMENT_LABELS = {
    entry: 'entrada',
    adjustment: 'ajuste',
    sale: 'venda',
    refund: 'devolução'
}

function validPositiveInteger(value) {
    return /^\d+$/.test(String(value)) && Number(value) >= 1
}

function MovementForm({ products, initialProductId, onCancel, onSaved }) {
    const [form, setForm] = useState({ ...emptyMovement, productId: initialProductId ?? products[0]?.id ?? '' })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const selectedProduct = products.find((product) => product.id === form.productId)
    const unitCost = Number(selectedProduct?.cost ?? 0)
    const canRegisterEntry = Number.isFinite(unitCost) && unitCost > 0
    const estimatedExpense = form.movementType === 'entry' && canRegisterEntry && validPositiveInteger(form.quantity)
        ? (unitCost * Number(form.quantity)).toFixed(2)
        : null

    function change(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setError('')
    }

    async function submit(event) {
        event.preventDefault()
        if (!form.productId) {
            setError('Selecione o produto.')
            return
        }
        if (!validPositiveInteger(form.quantity)) {
            setError('Informe uma quantidade inteira maior que zero.')
            return
        }
        if (form.movementType === 'adjustment' && !form.reason.trim()) {
            setError('Ajustes de estoque exigem motivo.')
            return
        }
        if (form.movementType === 'entry' && !canRegisterEntry) {
            setError('Cadastre um custo maior que zero neste produto antes de registrar a entrada.')
            return
        }

        const payload = {
            productId: form.productId,
            movementType: form.movementType,
            quantity: Number(form.quantity),
            direction: form.movementType === 'adjustment' ? Number(form.direction) : null,
            reason: form.reason.trim() || null,
            note: form.note.trim() || null
        }

        setSaving(true)
        setError('')
        try {
            await recordMovement(payload)
            onSaved('Estoque atualizado.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível registrar a movimentação.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel products-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>Registrar movimentação</h2>
                <p>Entradas somam ao estoque e geram despesa de compra pelo custo do produto. Ajustes não geram despesa e sempre exigem motivo.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="movement-product">Produto
                <select id="movement-product" name="productId" required value={form.productId} onChange={change}>
                    <option value="">Selecione um produto</option>
                    {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name} · {product.stock} em estoque</option>
                    ))}
                </select>
            </label>
            <label className="dashboard-management__field" htmlFor="movement-type">Tipo
                <select id="movement-type" name="movementType" value={form.movementType} onChange={change}>
                    <option value="entry">Entrada</option>
                    <option value="adjustment">Ajuste</option>
                </select>
            </label>
            <label className="dashboard-management__field" htmlFor="movement-quantity">Quantidade
                <input id="movement-quantity" name="quantity" type="number" min="1" required value={form.quantity} onChange={change} />
            </label>
            {form.movementType === 'adjustment' && (
                <label className="dashboard-management__field" htmlFor="movement-direction">Direção
                    <select id="movement-direction" name="direction" value={form.direction} onChange={change}>
                        <option value="1">Somar ao estoque</option>
                        <option value="-1">Subtrair do estoque</option>
                    </select>
                </label>
            )}
            <label className="dashboard-management__field products-form__wide" htmlFor="movement-reason">Motivo {form.movementType === 'adjustment' ? '(obrigatório)' : '(opcional)'}
                <input id="movement-reason" name="reason" type="text" maxLength={500} value={form.reason} onChange={change} />
            </label>
            <label className="dashboard-management__field products-form__wide" htmlFor="movement-note">Observação (opcional)
                <input id="movement-note" name="note" type="text" maxLength={500} value={form.note} onChange={change} />
            </label>
            {form.movementType === 'entry' && (
                <p className="products-form__wide products-movement-hint">
                    {estimatedExpense ? (
                        <>Despesa gerada no Financeiro de produtos: <strong>{formatMoney(estimatedExpense)}</strong> ({form.quantity} x {formatMoney(unitCost)}).</>
                    ) : (
                        <>Defina o custo do produto para registrar a entrada como despesa.</>
                    )}
                </p>
            )}
            {error && <p className="products-form__wide" role="alert">{error}</p>}
            <div className="dashboard-management__actions products-form__wide">
                <button className="dashboard-management__primary" type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : 'Registrar movimentação'}
                </button>
                <button className="dashboard-management__secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
            </div>
        </form>
    )
}

export default function ProductsMovements() {
    const [searchParams] = useSearchParams()
    const initialProductId = searchParams.get('productId') ?? ''
    const [products, setProducts] = useState([])
    const [movements, setMovements] = useState([])
    const [productFilter, setProductFilter] = useState(initialProductId)
    const [loadedKey, setLoadedKey] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [form, setForm] = useState('')
    const [movementProductId, setMovementProductId] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)

    const refresh = useCallback(() => setRefreshKey((current) => current + 1), [])
    const requestKey = `${productFilter}|${refreshKey}`
    const loading = loadedKey !== requestKey
    const productNames = useMemo(
        () => Object.fromEntries(products.map((product) => [product.id, product.name])),
        [products]
    )

    useEffect(() => {
        let active = true
        Promise.all([
            listProducts(),
            listMovements(productFilter || null)
        ])
            .then(([nextProducts, nextMovements]) => {
                if (!active) return
                setProducts(nextProducts)
                setMovements(nextMovements)
                setError('')
            })
            .catch((loadError) => {
                if (!active) return
                setError(getErrorMessage(loadError, 'Não foi possível carregar as movimentações.'))
            })
            .finally(() => {
                if (active) setLoadedKey(requestKey)
            })

        return () => { active = false }
    }, [productFilter, refreshKey, requestKey])

    function saved(text) {
        setMessage(text)
        setForm('')
        setMovementProductId('')
        refresh()
    }

    function openForm() {
        setMovementProductId(productFilter)
        setForm('movement')
    }

    return (
        <main className="dashboard-management products-page">
            <header className="dashboard-management__header">
                <p className="dashboard-eyebrow">Produtos</p>
                <h1>Movimentações de produtos</h1>
                <p>Registre entradas e ajustes, e acompanhe o histórico de estoque, vendas e devoluções.</p>
            </header>

            {message && <p className="dashboard-management__notice" role="status">{message}</p>}
            {error && <p className="products-error" role="alert">{error}</p>}

            <div className="products-actions">
                <button className="dashboard-management__primary" type="button" onClick={openForm} disabled={products.length === 0}>Nova movimentação</button>
            </div>

            {form === 'movement' && (
                <MovementForm
                    key={movementProductId || 'new'}
                    products={products}
                    initialProductId={movementProductId}
                    onCancel={() => { setForm(''); setMovementProductId('') }}
                    onSaved={saved}
                />
            )}

            {loading ? (
                <p className="dashboard-management__empty" role="status">Carregando movimentações...</p>
            ) : (
                <section className="dashboard-management__panel" aria-labelledby="movements-list-title">
                    <div className="dashboard-management__panel-heading">
                        <h2 id="movements-list-title">Histórico de estoque</h2>
                        <p>{movements.length} movimentação(ões) no filtro selecionado.</p>
                    </div>
                    <label className="dashboard-management__field products-filter" htmlFor="movement-filter">Filtrar por produto
                        <select id="movement-filter" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
                            <option value="">Todos os produtos</option>
                            {products.map((product) => (
                                <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                        </select>
                    </label>
                    {movements.length === 0 ? (
                        <p className="dashboard-management__empty">Nenhuma movimentação registrada.</p>
                    ) : (
                        <ul className="products-movements">
                            {movements.map((movement) => (
                                <li key={movement.id}>
                                    <div className="products-movements__copy">
                                        <strong>{productNames[movement.product_id] ?? 'Produto removido'} · {MOVEMENT_LABELS[movement.movement_type] ?? movement.movement_type}</strong>
                                        <span>{formatDateTime(movement.created_at)}{movement.reason ? ` · ${movement.reason}` : ''}</span>
                                        {movement.note && <small>{movement.note}</small>}
                                    </div>
                                    <span className={movement.direction === 1 ? 'products-movements__amount' : 'products-movements__amount products-movements__amount--out'}>
                                        {movement.direction === 1 ? '+' : '−'}{movement.quantity}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </main>
    )
}
