import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../hooks/useProfile.js'
import { getDashboardOverview } from '../../services/dashboardApi.js'
import './dashboard.css'

const TIME_ZONE = 'America/Fortaleza'

const icons = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
    wallet: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-13 5h3" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>
}

function Icon({ name }) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

function partsInFortaleza(value) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date(value))
    return Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
}

function fortalezaToday() {
    const { year, month, day } = partsInFortaleza(new Date())
    return `${year}-${month}-${day}`
}

function nextDay(date) {
    const value = new Date(`${date}T12:00:00Z`)
    value.setUTCDate(value.getUTCDate() + 1)
    return value.toISOString().slice(0, 10)
}

function formatDate(value) {
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE
    }).format(new Date(value))
}

function formatTime(value) {
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE
    }).format(new Date(value))
}

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function Dashboard() {
    const { loading: authLoading } = useAuth()
    const profile = useProfile()
    const [appointments, setAppointments] = useState([])
    const [financeSummary, setFinanceSummary] = useState(null)
    const [loadedKey, setLoadedKey] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)
    const [error, setError] = useState('')

    const today = fortalezaToday()
    const from = `${today}T00:00:00-03:00`
    const to = `${nextDay(today)}T00:00:00-03:00`
    const requestKey = `${from}|${to}|${refreshKey}`
    const loading = loadedKey !== requestKey

    useEffect(() => {
        let active = true
        getDashboardOverview(from, to)
            .then((overview) => {
                if (!active) return
                setAppointments(overview.appointments ?? [])
                setFinanceSummary(overview.financeSummary ?? null)
                setError('')
                setLoadedKey(requestKey)
            })
            .catch((loadError) => {
                if (!active) return
                setError(loadError.response?.data?.error || 'Não foi possível carregar o resumo de hoje.')
                setLoadedKey(requestKey)
            })
        return () => { active = false }
    }, [from, to, requestKey])

    if (authLoading) return <p className="dashboard-loading">Carregando dashboard...</p>

    const { hour } = partsInFortaleza(new Date())
    const profileName = profile?.name || 'Barbeiro'
    const greeting = Number(hour) < 12 ? 'Bom dia' : Number(hour) < 18 ? 'Boa tarde' : 'Boa noite'
    const confirmed = appointments.filter((appointment) => appointment.status === 'confirmed')
    const cancelled = appointments.filter((appointment) => appointment.status === 'cancelled')
    const upcoming = confirmed
        .filter((appointment) => new Date(appointment.starts_at).getTime() >= new Date())
        .sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at))
    const revenue = financeSummary ? formatMoney(financeSummary.revenue) : '—'

    const metrics = [
        { key: 'today', label: 'Agendamentos de hoje', value: String(appointments.length).padStart(2, '0'), detail: 'Na agenda de hoje', icon: 'calendar' },
        { key: 'confirmed', label: 'Confirmados', value: String(confirmed.length).padStart(2, '0'), detail: 'Horários reservados', icon: 'check' },
        { key: 'cancelled', label: 'Cancelamentos', value: String(cancelled.length).padStart(2, '0'), detail: 'Neste dia', icon: 'close' },
        { key: 'revenue', label: 'Receita recebida hoje', value: revenue, detail: financeSummary ? 'Pagamentos registrados hoje' : 'Resumo indisponível', icon: 'wallet' }
    ]

    return (
        <main className="dashboard-home">
            <header className="dashboard-welcome">
                <div>
                    <p className="dashboard-eyebrow">{formatDate(new Date())}</p>
                    <h1>{greeting}, {profileName}</h1>
                    <p className="dashboard-welcome__copy">Aqui está o resumo do movimento da sua barbearia hoje.</p>
                </div>
            </header>

            {loading ? (
                <p className="dashboard-loading" role="status">Carregando indicadores de hoje...</p>
            ) : error ? (
                <div className="dashboard-panel dashboard-error">
                    <p role="alert">{error}</p>
                    <button className="dashboard-retry" type="button" onClick={() => setRefreshKey((current) => current + 1)}>Tentar novamente</button>
                </div>
            ) : (
                <>
                    <section className="dashboard-metrics" aria-label="Indicadores de hoje">
                        {metrics.map((metric) => (
                            <article className="dashboard-metric" key={metric.key}>
                                <div className={`dashboard-metric__icon dashboard-metric__icon--${metric.key}`}><Icon name={metric.icon} /></div>
                                <p className="dashboard-metric__label">{metric.label}</p>
                                <p className="dashboard-metric__value">{metric.value}</p>
                                <p className="dashboard-metric__detail">{metric.detail}</p>
                            </article>
                        ))}
                    </section>

                    <div className="dashboard-overview-grid">
                        <section className="dashboard-panel dashboard-appointments" aria-labelledby="appointments-title">
                            <div className="dashboard-panel__heading">
                                <div><p className="dashboard-eyebrow">A seguir</p><h2 id="appointments-title">Próximos agendamentos</h2></div>
                            </div>
                            {upcoming.length === 0 ? (
                                <p className="dashboard-appointment-empty">Nenhum agendamento futuro para hoje.</p>
                            ) : (
                                <div className="dashboard-appointment-list">
                                    {upcoming.slice(0, 5).map((appointment) => (
                                        <article className="dashboard-appointment" key={appointment.id}>
                                            <time className="dashboard-appointment__time">{formatTime(appointment.starts_at)}</time>
                                            <div className="dashboard-appointment__person"><strong>{appointment.customer_name}</strong><span>{appointment.service?.name || 'Serviço não informado'}</span></div>
                                            <span className="dashboard-status">Confirmado</span>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="dashboard-panel dashboard-progress" aria-labelledby="progress-title">
                            <div className="dashboard-panel__heading">
                                <div><p className="dashboard-eyebrow">Hoje</p><h2 id="progress-title">Situação da agenda</h2></div>
                            </div>
                            {appointments.length === 0 ? (
                                <p className="dashboard-appointment-empty">Ainda não há agendamentos registrados hoje.</p>
                            ) : (
                                <>
                                    <div className="dashboard-progress__summary"><strong>{confirmed.length} de {appointments.length}</strong><span>agendamentos confirmados</span></div>
                                    <div className="dashboard-progress__track" role="img" aria-label={`${confirmed.length} de ${appointments.length} agendamentos confirmados`}>
                                        <span style={{ width: `${(confirmed.length / appointments.length) * 100}%` }} />
                                    </div>
                                    <div className="dashboard-progress__legend">
                                        <span><i className="dashboard-progress__dot dashboard-progress__dot--done" />Confirmados <strong>{confirmed.length}</strong></span>
                                        <span><i className="dashboard-progress__dot dashboard-progress__dot--pending" />Cancelados <strong>{cancelled.length}</strong></span>
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                </>
            )}

            <div className="dashboard-agenda-access">
                <span>Precisa ver todos os horários do dia?</span>
                <Link to="/dashboard/agenda">Agenda completa <Icon name="arrow" /></Link>
            </div>
        </main>
    )
}
