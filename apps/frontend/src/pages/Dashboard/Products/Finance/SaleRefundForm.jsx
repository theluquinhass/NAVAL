import { useMemo, useState } from 'react'
import { createRefund } from '../../../../services/financeApi.js'
import {
    fortalezaInputValue,
    formatDateTime,
    formatMoney,
    getErrorMessage,
    moneyToCents,
    toFortalezaIso
} from '../../../../utils/dashboard.js'
import { validAmount } from '../../Finance/financeValidation.js'

export default function SaleRefundForm({ payments, refunds, initialPaymentId, onCancel, onSaved }) {
    const refundedCentsByPayment = useMemo(() => refunds.reduce((totals, refund) => {
        totals[refund.payment_id] = (totals[refund.payment_id] ?? 0) + moneyToCents(refund.amount)
        return totals
    }, {}), [refunds])
    const [form, setForm] = useState({
        paymentId: initialPaymentId || payments[0]?.id || '',
        amount: '',
        refundedAt: fortalezaInputValue(),
        reason: ''
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const selectedPayment = payments.find((payment) => payment.id === form.paymentId)
    const remainingCents = selectedPayment
        ? Math.max(0, moneyToCents(selectedPayment.amount) - (refundedCentsByPayment[selectedPayment.id] ?? 0))
        : 0

    function change(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setError('')
    }

    async function submit(event) {
        event.preventDefault()
        if (!form.paymentId) {
            setError('Selecione a venda que está sendo estornada.')
            return
        }
        if (!validAmount(form.amount)) {
            setError('Informe o valor estornado, com até duas casas decimais.')
            return
        }
        if (remainingCents > 0 && moneyToCents(form.amount) > remainingCents) {
            setError(`O valor restante para estorno é ${formatMoney(remainingCents / 100)}.`)
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
            onSaved('Estorno financeiro registrado. O estoque não foi alterado.')
        } catch (submitError) {
            setError(getErrorMessage(submitError, 'Não foi possível registrar o estorno.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="dashboard-management__panel finance-form" onSubmit={submit}>
            <div className="dashboard-management__panel-heading">
                <h2>Estorno financeiro de venda</h2>
                <p>O pagamento original permanece no histórico. Este estorno não devolve itens ao estoque.</p>
            </div>
            <label className="dashboard-management__field" htmlFor="sale-refund-payment">Venda
                <select id="sale-refund-payment" name="paymentId" required value={form.paymentId} onChange={change}>
                    <option value="">Selecione uma venda</option>
                    {payments.map((payment) => {
                        const remaining = Math.max(0, moneyToCents(payment.amount) - (refundedCentsByPayment[payment.id] ?? 0)) / 100
                        return (
                            <option key={payment.id} value={payment.id}>
                                {formatDateTime(payment.paid_at)} · {formatMoney(payment.amount)} · restante {formatMoney(remaining)}
                            </option>
                        )
                    })}
                </select>
            </label>
            <label className="dashboard-management__field" htmlFor="sale-refund-amount">Valor estornado (R$)
                <input id="sale-refund-amount" name="amount" type="text" inputMode="decimal" required value={form.amount} onChange={change} placeholder="0.00" />
            </label>
            <label className="dashboard-management__field" htmlFor="sale-refund-date">Estornado em (Fortaleza)
                <input id="sale-refund-date" name="refundedAt" type="datetime-local" required value={form.refundedAt} onChange={change} />
            </label>
            <label className="dashboard-management__field" htmlFor="sale-refund-reason">Motivo (opcional)
                <input id="sale-refund-reason" name="reason" type="text" maxLength={500} value={form.reason} onChange={change} />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="dashboard-management__actions">
                <button className="dashboard-management__primary" type="submit" disabled={saving}>{saving ? 'Estornando...' : 'Registrar estorno'}</button>
                <button className="dashboard-management__secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
            </div>
        </form>
    )
}
