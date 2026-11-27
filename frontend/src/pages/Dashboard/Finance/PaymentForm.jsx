import { useState } from 'react'
import { createPayment } from '../../../services/financeApi.js'
import {
    fortalezaInputValue,
    formatDateTime,
    getErrorMessage,
    toFortalezaIso
} from '../../../utils/dashboard.js'
import { validAmount } from './financeValidation.js'
import FormActions from './FormActions.jsx'

export default function PaymentForm({ appointments, appointmentsError, onCancel, onSaved }) {
    const [form, setForm] = useState({
        appointmentId: '', amount: '', paidAt: fortalezaInputValue(), method: 'Pix', note: ''
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
        if (!validAmount(form.amount)) {
            setError('Informe o valor efetivamente recebido, com até duas casas decimais.')
            return
        }
        if (!form.paidAt) {
            setError('Informe quando o pagamento foi recebido.')
            return
        }

        setSaving(true)
        setError('')
        try {
            await createPayment({
                appointmentId: form.appointmentId || null,
                amount: form.amount,
                paidAt: toFortalezaIso(form.paidAt),
                method: form.method.trim(),
                note: form.note.trim() || null
            })
            onSaved('Pagamento registrado.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível registrar o pagamento.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel finance-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>Registrar pagamento</h2>
                <p>O valor é o que foi efetivamente recebido. Vincular a um agendamento é opcional e não altera o status dele.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="payment-amount">Valor recebido (R$)
                <input id="payment-amount" name="amount" type="text" inputMode="decimal" required value={form.amount} onChange={change} placeholder="0,00 use ponto: 25.50" />
            </label>
            <label className="dashboard-management__field" htmlFor="payment-date">Recebido em (Fortaleza)
                <input id="payment-date" name="paidAt" type="datetime-local" required value={form.paidAt} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="payment-method">Forma de pagamento
                <input id="payment-method" name="method" type="text" required maxLength={50} value={form.method} onChange={change} placeholder="Pix, dinheiro, cartão..." />
            </label>
            <label className="dashboard-management__field" htmlFor="payment-appointment">Agendamento (opcional)
                <select id="payment-appointment" name="appointmentId" value={form.appointmentId} onChange={change}>
                    <option value="">Sem agendamento vinculado</option>
                    {appointments.map((appointment) => (
                        <option key={appointment.id} value={appointment.id}>
                            {formatDateTime(appointment.starts_at)} · {appointment.customer_name}
                        </option>
                    ))}
                </select>
            </label>
            {appointmentsError && <p className="finance-form__hint" role="alert">{appointmentsError}</p>}
            <label className="dashboard-management__field" htmlFor="payment-note">Observação (opcional)
                <input id="payment-note" name="note" type="text" maxLength={500} value={form.note} onChange={change} />
            </label>
            {error && <p role="alert">{error}</p>}
            <FormActions saving={saving} onCancel={onCancel} label="Registrar pagamento" />
        </form>
    )
}
