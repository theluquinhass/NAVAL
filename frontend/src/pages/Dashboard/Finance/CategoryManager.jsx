import { useState } from 'react'
import { createCategory, deleteCategory, updateCategory } from '../../../services/financeApi.js'
import { getErrorMessage } from '../../../utils/dashboard.js'

export default function CategoryManager({ categories, onChanged, notify }) {
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
