import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    createProduct,
    deleteProduct,
    listProducts,
    setProductActive,
    updateProduct
} from '../../../services/productsApi.js'
import { formatMoney, getErrorMessage } from '../../../utils/dashboard.js'
import { useLatestRequest } from '../../../hooks/useLatestRequest.js'
import { useConfirm } from '../../../components/ui/feedbackContext.js'
import EmptyState from '../../../components/ui/EmptyState.jsx'
import Icon from '../../../components/ui/Icon.jsx'
import '../management.css'
import './products.css'

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/

function validMoney(value, { allowZero = false } = {}) {
    return MONEY_PATTERN.test(String(value)) && Number(value) >= (allowZero ? 0 : 0.01)
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
                <p>Preço e custo são usados nas vendas. O custo também gera a despesa de cada entrada de estoque.</p>
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

export default function Products() {
    const navigate = useNavigate()
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [form, setForm] = useState('')
    const [editingProduct, setEditingProduct] = useState(null)
    const [busyId, setBusyId] = useState('')
    const beginProductsRequest = useLatestRequest()
    const confirm = useConfirm()

    const loadProducts = useCallback(async () => {
        const isCurrent = beginProductsRequest()
        try {
            const nextProducts = await listProducts()
            if (isCurrent()) {
                setProducts(nextProducts)
                setError('')
            }
        } catch (loadError) {
            if (!isCurrent()) return
            setProducts([])
            setError(getErrorMessage(loadError, 'Não foi possível carregar os produtos.'))
        } finally {
            if (isCurrent()) setLoading(false)
        }
    }, [beginProductsRequest])

    useEffect(() => {
        // State updates happen after the request resolves, not during the effect body.
        // Stale responses and post-unmount updates are dropped by useLatestRequest.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadProducts()
    }, [loadProducts])


    function saved(text) {
        setMessage(text)
        setForm('')
        setEditingProduct(null)
        loadProducts()
    }

    function openMovements(productId = '') {
        const query = productId ? `?productId=${encodeURIComponent(productId)}` : ''
        navigate(`/dashboard/products/movements${query}`)
    }

    async function toggle(product) {
        setBusyId(product.id)
        setError('')
        try {
            await setProductActive(product.id, !product.is_active)
            setMessage(product.is_active ? 'Produto desativado.' : 'Produto ativado.')
            loadProducts()
        } catch (toggleError) {
            setError(getErrorMessage(toggleError, 'Não foi possível atualizar o produto.'))
        } finally {
            setBusyId('')
        }
    }

    async function remove(product) {
        const accepted = await confirm({
            title: `Excluir "${product.name}"?`,
            message: 'Produtos com histórico de movimentações ou vendas não podem ser excluídos; nesse caso, desative o produto.',
            confirmLabel: 'Excluir produto',
            tone: 'danger'
        })
        if (!accepted) return
        setBusyId(product.id)
        setError('')
        try {
            await deleteProduct(product.id)
            setMessage('Produto excluído.')
            loadProducts()
        } catch (removeError) {
            setError(getErrorMessage(removeError, 'Não foi possível excluir o produto.'))
        } finally {
            setBusyId('')
        }
    }

    return (
        <main className="dashboard-management products-page">
            <header className="dashboard-management__header">
                <p className="dashboard-eyebrow">Produtos</p>
                <h1>Estoque de produtos</h1>
                <p>Cadastre o que você vende e acompanhe o saldo. O estoque muda pelas movimentações: entradas, ajustes e vendas.</p>
            </header>

            {message && <p className="dashboard-management__notice" role="status">{message}</p>}
            {error && (
                <div className="products-error" role="alert">
                    <p>{error}</p>
                    <button className="dashboard-management__secondary" type="button" onClick={() => {
                        setLoading(true)
                        loadProducts()
                    }}>Tentar novamente</button>
                </div>
            )}

            <div className="products-actions">
                <button className="dashboard-management__primary" type="button" onClick={() => { setEditingProduct(null); setForm('product') }}><Icon name="plus" />Novo produto</button>
                <button className="dashboard-management__secondary" type="button" onClick={() => openMovements()} disabled={products.length === 0}><Icon name="swap" />Registrar movimentação</button>
            </div>

            {form === 'product' && (
                <ProductForm
                    key={editingProduct?.id ?? 'new'}
                    product={editingProduct}
                    onCancel={() => { setForm(''); setEditingProduct(null) }}
                    onSaved={saved}
                />
            )}

            {loading ? (
                <p className="dashboard-management__empty" role="status">Carregando produtos...</p>
            ) : (
                <section className="dashboard-management__panel" aria-labelledby="products-list-title">
                    <div className="dashboard-management__panel-heading">
                        <h2 id="products-list-title">Catálogo e saldo</h2>
                        <p>{products.length} produto(s) cadastrado(s). O estoque vem do histórico de movimentações.</p>
                    </div>
                    {products.length === 0 ? (
                        <EmptyState icon="box" title="Nenhum produto cadastrado">
                            Comece pelo botão “Novo produto”. Depois registre uma entrada para ter saldo em estoque.
                        </EmptyState>
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
                                                <td data-label="Produto">
                                                    <strong>{product.name}</strong>
                                                    {product.description && <small>{product.description}</small>}
                                                </td>
                                                <td data-label="SKU">{product.sku || '—'}</td>
                                                <td data-label="Preço">{formatMoney(product.price)}</td>
                                                <td data-label="Custo">{product.cost === null ? '—' : formatMoney(product.cost)}</td>
                                                <td data-label="Estoque">
                                                    <span className={lowStock ? 'products-stock products-stock--low' : 'products-stock'}>
                                                        {product.stock}
                                                    </span>
                                                </td>
                                                <td data-label="Status">
                                                    <span className={product.is_active ? 'products-status' : 'products-status products-status--inactive'}>
                                                        {product.is_active ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>
                                                <td className="products-table__actions">
                                                    <div className="products-actions products-actions--row">
                                                        <button className="dashboard-management__secondary" type="button" disabled={busyId === product.id} onClick={() => { setEditingProduct(product); setForm('product') }}>Editar</button>
                                                        <button className="dashboard-management__secondary" type="button" disabled={busyId === product.id} onClick={() => openMovements(product.id)}>Movimentar</button>
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
            )}
        </main>
    )
}
