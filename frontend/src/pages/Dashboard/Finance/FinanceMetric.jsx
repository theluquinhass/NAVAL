import { formatMoney } from '../../../utils/dashboard.js'

export default function Metric({ label, value, detail, tone }) {
    return (
        <article className={`finance-metric${tone ? ` finance-metric--${tone}` : ''}`}>
            <span className="finance-metric__label">{label}</span>
            <strong className="finance-metric__value">{formatMoney(value)}</strong>
            {detail && <span className="finance-metric__detail">{detail}</span>}
        </article>
    )
}
