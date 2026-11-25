import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    createProduct,
    deleteProduct,
    listMovements,
    listProducts,
    recordMovement,
    setProductActive,
    updateProduct
} from '../../../services/productsApi.js'
import '../management.css'
import './products.css'

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/
const TIME_ZONE = 'America/Fortaleza'
const emptyMovement = { productId: '', movementType: 'entry', quantity: '', direction: '1', reason: '', note: '' }

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

function validMoney(value, { allowZero = false } = {}) {
    return MONEY_PATTERN.test(String(value)) && Number(value) >= (allowZero ? 0 : 0.01)
}

function validPositiveInteger(value) {
    return /^\d+$/.test(String(value)) && Number(value) >= 1
}

function ProductForm({ product, onCancel, onSaved }) {
    const [form, setForm] = useState({
        name: product?.name ?? '',
        description: product?.description ?? '',
        price: product?.price ?? '',
        cost: product?.cost ?? '',
        sku: product?.sku ?? '',
        lowStockThreshold: product?.low_stock_threshold ?? ''
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
        if (!form.name.trim()) {
            setError('Informe o nome do produto.')
            return
        }
        if (!validMoney(form.price)) {
            setError('Informe o preço com até duas casas decimais.')
            return
        }
        if (form.cost !== '' && !validMoney(form.cost, { allowZero: true })) {
            setError('O custo deve ser zero ou um valor com até duas casas decimais.')
            return
        }
        if (form.lowStockThreshold !== '' && !/^\d+$/.test(String(form.lowStockThreshold))) {
            setError('O limite de estoque baixo deve ser um número inteiro.')
            return
        }

        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            price: form.price,
            cost: form.cost === '' ? null : form.cost,
            sku: form.sku.trim() || null,
            lowStockThreshold: form.lowStockThreshold === '' ? null : Number(form.lowStockThreshold)
        }

        setSaving(true)
        setError('')
        try {
            if (product) await updateProduct(product.id, payload)
            else await createProduct(payload)
            onSaved(product ? 'Produto atualizado.' : 'Produto cadastrado.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível salvar o produto.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel products-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>{product ? 'Editar produto' : 'Novo produto'}</h2>
                <p>Preço e custo são usados como referência nas vendas; o valor da venda é calculado no servidor.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="product-name">Nome
                <input id="product-name" name="name" type="text" maxLength={120} required value={form.name} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="product-price">Preço de venda (R$)
                <input id="product-price" name="price" type="text" inputMode="decimal" required value={form.price} onChange={change} placeholder="25.90" />
            </label>
            <label className="dashboard-management__field" htmlFor="product-cost">Custo (R$, opcional)
                <input id="product-cost" name="cost" type="text" inputMode="decimal" value={form.cost} onChange={change} placeholder="12.00" />
            </label>
            <label className="dashboard-management__field" htmlFor="product-sku">SKU (opcional)
                <input id="product-sku" name="sku" type="text" maxLength={64} value={form.sku} onChange={change} placeholder="POMADA-01" />
            </label>
            <label className="dashboard-management__field" htmlFor="product-threshold">Alerta de estoque baixo (opcional)
                <input id="product-threshold" name="lowStockThreshold" type="number" min="0" value={form.lowStockThreshold} onChange={change} />
            </label>
            <label className="dashboard-management__field products-form__wide" htmlFor="product-description">Descrição (opcional)
                <input id="product-description" name="description" type="text" maxLength={500} value={form.description} onChange={change} />
            </label>
            {error && <p className="products-form__wide" role="alert">{error}</p>}
            <div className="dashboard-management__actions products-form__wide">
                <button className="dashboard-management__primary" type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : product ? 'Salvar alterações' : 'Cadastrar produto'}
                </button>
                <button className="dashboard-management__secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
            </div>
        </form>
    )
}

function MovementForm({ products, initialProductId, onCancel, onSaved }) {
    const [form, setForm] = useState({ ...emptyMovement, productId: initialProductId ?? products[0]?.id ?? '' })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

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
                <h2>Movimentar estoque</h2>
                <p>Entradas somam; ajustes podem somar ou subtrair e sempre exigem motivo. Baixas por venda são registradas automaticamente.</p>
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

export default function Products() {
    const [products, setProducts] = useState([])
    const [movements, setMovements] = useState([])
    const [productFilter, setProductFilter] = useState('')
    const [loadedKey, setLoadedKey] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [form, setForm] = useState('')
    const [editingProduct, setEditingProduct] = useState(null)
    const [movementProductId, setMovementProductId] = useState('')
    const [busyId, setBusyId] = useState('')
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
                setError(getErrorMessage(loadError, 'Não foi possível carregar os produtos.'))
            })
            .finally(() => {
                if (active) setLoadedKey(requestKey)
            })

        return () => { active = false }
    }, [productFilter, refreshKey, requestKey])

    function saved(text) {
        setMessage(text)
        setForm('')
        setEditingProduct(null)
        setMovementProductId('')
        refresh()
    }

    async function toggle(product) {
        setBusyId(product.id)
        setError('')
        try {
            await setProductActive(product.id, !product.is_active)
            setMessage(product.is_active ? 'Produto desativado.' : 'Produto ativado.')
            refresh()
        } catch (toggleError) {
            setError(getErrorMessage(toggleError, 'Não foi possível atualizar o produto.'))
        } finally {
            setBusyId('')
        }
    }

    async function remove(product) {
        if (!window.confirm(`Excluir "${product.name}"? Produtos com histórico não podem ser excluídos.`)) return
        setBusyId(product.id)
        setError('')
        try {
            await deleteProduct(product.id)
            setMessage('Produto excluído.')
            refresh()
        } catch (removeError) {
            setError(getErrorMessage(removeError, 'Não foi possível excluir o produto.'))
        } finally {
            setBusyId('')
        }
    }

    return (
        <main className="dashboard-management products-page">
            <header className="dashboard-management__header">
                <p className="dashboard-eyebrow">Gestão</p>
                <h1>Produtos e estoque</h1>
                <p>Cadastre itens, registre entradas e acompanhe o saldo derivado das movimentações. Vendas baixam o estoque automaticamente.</p>
            </header>

            {message && <p className="dashboard-management__notice" role="status">{message}</p>}
            {error && <p className="finance-error" role="alert">{error}</p>}

            <div className="products-actions">
                <button className="dashboard-management__primary" type="button" onClick={() => { setEditingProduct(null); setForm('product') }}>Novo produto</button>
                <button className="dashboard-management__secondary" type="button" onClick={() => { setMovementProductId(''); setForm('movement') }} disabled={products.length === 0}>Movimentar estoque</button>
            </div>

            {form === 'product' && (
                <ProductForm
                    key={editingProduct?.id ?? 'new'}
                    product={editingProduct}
                    onCancel={() => { setForm(''); setEditingProduct(null) }}
                    onSaved={saved}
                />
            )}
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
                <p className="dashboard-management__empty" role="status">Carregando produtos...</p>
            ) : (
                <>
                    <section className="dashboard-management__panel" aria-labelledby="products-list-title">
                        <div className="dashboard-management__panel-heading">
                            <h2 id="products-list-title">Catálogo</h2>
                            <p>{products.length} produto(s) cadastrado(s).</p>
                        </div>
                        {products.length === 0 ? (
                            <p className="dashboard-management__empty">Nenhum produto cadastrado. Comece pelo botão “Novo produto”.</p>
                        ) : (
                            <div className="products-table-wrap">
                                <table className="products-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Produto</th>
                                            <th scope="col">SKU</th>
                                            <th scope="col">Preço</th>
                                            <th scope="col">Custo</th>
                                            <th scope="col">Estoque</th>
                                            <th scope="col">Status</th>
                                            <th scope="col">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((product) => {
                                            const lowStock = product.low_stock_threshold !== null
                                                && product.stock <= product.low_stock_threshold
                                            return (
                                                <tr key={product.id}>
                                                    <td>
                                                        <strong>{product.name}</strong>
                                                        {product.description && <small>{product.description}</small>}
                                                    </td>
                                                    <td>{product.sku || '—'}</td>
                                                    <td>{formatMoney(product.price)}</td>
                                                    <td>{product.cost === null ? '—' : formatMoney(product.cost)}</td>
                                                    <td>
                                                        <span className={lowStock ? 'products-stock products-stock--low' : 'products-stock'}>
                                                            {product.stock}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={product.is_active ? 'products-status' : 'products-status products-status--inactive'}>
                                                            {product.is_active ? 'Ativo' : 'Inativo'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="products-actions products-actions--row">
                                                            <button className="dashboard-management__secondary" type="button" disabled={busyId === product.id} onClick={() => { setEditingProduct(product); setForm('product') }}>Editar</button>
                                                            <button className="dashboard-management__secondary" type="button" disabled={busyId === product.id} onClick={() => { setMovementProductId(product.id); setForm('movement') }}>Movimentar</button>
                                                            <button className="dashboard-management__secondary" type="button" disabled={busyId === product.id} onClick={() => toggle(product)}>{product.is_active ? 'Desativar' : 'Ativar'}</button>
                                                            <button className="dashboard-management__danger" type="button" disabled={busyId === product.id} onClick={() => remove(product)}>Excluir</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="dashboard-management__panel" aria-labelledby="movements-list-title">
                        <div className="dashboard-management__panel-heading">
                            <h2 id="movements-list-title">Histórico de estoque</h2>
                            <p>Entradas, ajustes, vendas e devoluções registradas para os produtos.</p>
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
                                            <strong>{productNames[movement.product_id] ?? 'Produto removido'} · {movement.movement_type}</strong>
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
                </>
            )}
        </main>
    )
}
