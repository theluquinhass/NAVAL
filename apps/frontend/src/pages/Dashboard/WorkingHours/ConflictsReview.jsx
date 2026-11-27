import { formatAppointmentDate } from './scheduleUtils.js'

/** Shown when saving would leave confirmed appointments outside the new working hours. */
export default function ConflictsReview({ conflicts, saving, onReview, onConfirm }) {
    return (
        <section className="working-hours__conflicts" aria-labelledby="working-hours-conflicts-title" role="alert">
            <h3 id="working-hours-conflicts-title">Revise os agendamentos afetados</h3>
            <p>{conflicts.total} {conflicts.total === 1 ? 'agendamento confirmado ficará' : 'agendamentos confirmados ficarão'} fora dos novos períodos. Salvar não altera nem cancela essas reservas; novos agendamentos passarão a respeitar a grade salva.</p>
            {conflicts.items.length > 0 && (
                <ul>
                    {conflicts.items.map((appointment) => (
                        <li key={appointment.id}>
                            <strong>{appointment.customer_name}</strong> · {formatAppointmentDate(appointment.starts_at)}
                        </li>
                    ))}
                </ul>
            )}
            {conflicts.total > conflicts.items.length && <p>Exibindo {conflicts.items.length} de {conflicts.total} agendamentos.</p>}
            <div className="dashboard-management__actions">
                <button className="dashboard-management__secondary" type="button" onClick={onReview} disabled={saving}>Revisar horários</button>
                <button className="dashboard-management__primary" type="button" onClick={onConfirm} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar e manter agendamentos'}
                </button>
            </div>
        </section>
    )
}
