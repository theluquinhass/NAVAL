import { useState } from 'react'
import { createRefund } from '../../../services/financeApi.js'
import {
    fortalezaInputValue,
    formatDateTime,
    formatMoney,
    getErrorMessage,
    toFortalezaIso
} from '../../../utils/dashboard.js'
import { validAmount } from './financeValidation.js'
import FormActions from './FormActions.jsx'

export default function RefundForm({ payments, initialPaymentId, onCancel, onSaved }) {
    const [form, setForm] = useState({
        paymentId: initialPaymentId || payments[0]?.id || '',
        amount: '',
        refundedAt: fortalezaInputValue(),
        reason: ''
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
        if (!form.paymentId) {
            setError('Selecione o pagamento que está sendo estornado.')
            return
        }
        if (!validAmount(form.amount)) {
            setError('Informe o valor estornado, com até duas casas decimais.')
            return
        }

        setSaving(true)
        setError('')
        try {
            await createRefund({
                paymentId: form.paymentId,
                amount: form.amount,
                refundedAt: toFortalezaIso(form.refundedAt),
                reason: form.reason.trim() || null
            })
            onSaved('Estorno registrado. O pagamento original foi mantido.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível registrar o estorno.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel finance-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>Registrar estorno</h2>
                <p>O estorno é um evento separado: o pagamento original permanece no histórico.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="refund-payment">Pagamento
                <select id="refund-payment" name="paymentId" required value={form.paymentId} onChange={change}>
                    <option value="">Selecione um pagamento</option>
                    {payments.map((payment) => (
                        <option key={payment.id} value={payment.id}>
                            {formatDateTime(payment.paid_at)} · {formatMoney(payment.amount)} · {payment.method}
                        </option>
                    ))}
                </select>
            </label>
            <label className="dashboard-management__field" htmlFor="refund-amount">Valor estornado (R$)
                <input id="refund-amount" name="amount" type="text" inputMode="decimal" required value={form.amount} onChange={change} placeholder="0.00" />
            </label>
            <label className="dashboard-management__field" htmlFor="refund-date">Estornado em (Fortaleza)
                <input id="refund-date" name="refundedAt" type="datetime-local" required value={form.refundedAt} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="refund-reason">Motivo (opcional)
                <input id="refund-reason" name="reason" type="text" maxLength={500} value={form.reason} onChange={change} />
            </label>
            {error && <p role="alert">{error}</p>}
            <FormActions saving={saving} onCancel={onCancel} label="Registrar estorno" />
        </form>
    )
}
