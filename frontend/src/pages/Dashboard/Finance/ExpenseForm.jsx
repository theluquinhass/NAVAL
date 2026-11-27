import { useState } from 'react'
import { createExpense, updateExpense } from '../../../services/financeApi.js'
import { fortalezaInputValue, getErrorMessage, toFortalezaIso } from '../../../utils/dashboard.js'
import { validAmount } from './financeValidation.js'
import FormActions from './FormActions.jsx'

export default function ExpenseForm({ categories, expense, onCancel, onSaved }) {
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
