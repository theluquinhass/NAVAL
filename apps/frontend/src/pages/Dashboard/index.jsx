import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useProfile } from '../../hooks/useProfile.js'
import { getDashboardOverview } from '../../services/dashboardApi.js'
import {
    fortalezaToday,
    formatMoney,
    getErrorMessage,
    periodBounds,
    TIME_ZONE
} from '../../utils/dashboard.js'
import Icon from '../../components/ui/Icon.jsx'
import PageHeader from '../../components/ui/PageHeader.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import ShareBookingLink from '../../components/ShareBookingLink.jsx'
import { hasSharedBookingLink } from '../../components/shareBookingLinkState.js'
import OnboardingChecklist from './OnboardingChecklist.jsx'
import './dashboard.css'

const UPCOMING_LIMIT = 5

function hourInFortaleza(value) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: '2-digit', hour12: false }).formatToParts(value)
    return Number(parts.find((part) => part.type === 'hour')?.value ?? 12)
}

function formatDate(value) {
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE
    }).format(value)
}

function formatTime(value) {
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE
    }).format(new Date(value))
}

function greetingFor(hour) {
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
}

function TodayMetrics({ appointments, confirmed, cancelled, financeSummary }) {
    const metrics = [
        { key: 'today', label: 'Agendamentos hoje', value: appointments.length, icon: 'calendar' },
        { key: 'confirmed', label: 'Confirmados', value: confirmed.length, icon: 'check' },
        { key: 'cancelled', label: 'Cancelados', value: cancelled.length, icon: 'closeCircle' },
        { key: 'revenue', label: 'Recebido hoje', value: financeSummary ? formatMoney(financeSummary.revenue) : '—', icon: 'wallet' }
    ]
    return (
        <section className="dashboard-metrics" aria-label="Indicadores de hoje">
            {metrics.map((metric) => (
                <article className={`dashboard-metric dashboard-metric--${metric.key}`} key={metric.key}>
                    <span className="dashboard-metric__icon"><Icon name={metric.icon} /></span>
                    <p className="dashboard-metric__label">{metric.label}</p>
                    <p className="dashboard-metric__value">{metric.value}</p>
                </article>
            ))}
        </section>
    )
}

function UpcomingAppointments({ upcoming }) {
    return (
        <section className="dashboard-panel" aria-labelledby="appointments-title">
            <div className="dashboard-panel__heading">
                <h2 id="appointments-title">Próximos clientes de hoje</h2>
                <Link className="ui-button ui-button--ghost" to="/dashboard/agenda">Ver agenda<Icon name="arrowRight" /></Link>
            </div>
            {upcoming.length === 0 ? (
                <EmptyState icon="calendar" title="Nenhum cliente marcado para o resto do dia">
                    Quando alguém agendar pela sua página, o horário aparece aqui.
                </EmptyState>
            ) : (
                <ol className="dashboard-appointment-list">
                    {upcoming.slice(0, UPCOMING_LIMIT).map((appointment) => (
                        <li className="dashboard-appointment" key={appointment.id}>
                            <time className="dashboard-appointment__time" dateTime={appointment.starts_at}>{formatTime(appointment.starts_at)}</time>
                            <div className="dashboard-appointment__person">
                                <strong>{appointment.customer_name}</strong>
                                <span>{appointment.service?.name || 'Serviço não informado'}</span>
                            </div>
                            <span className="ui-badge ui-badge--success">Confirmado</span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    )
}

export default function Dashboard() {
    const { loading: authLoading } = useAuth()
    const profile = useProfile()
    const [appointments, setAppointments] = useState([])
    const [financeSummary, setFinanceSummary] = useState(null)
    const [loadedKey, setLoadedKey] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)
    const [error, setError] = useState('')
    const [linkShared, setLinkShared] = useState(() => hasSharedBookingLink(profile?.slug))
    const today = fortalezaToday()
    const { from, to } = periodBounds(today, today)
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
                setError(getErrorMessage(loadError, 'Não foi possível carregar o resumo de hoje.'))
                setLoadedKey(requestKey)
            })
        return () => { active = false }
    }, [from, to, requestKey])

    if (authLoading) return <p className="dashboard-loading" role="status">Carregando painel...</p>

    const now = new Date()
    const firstName = (profile?.barberName || profile?.name || '').split(' ')[0] || 'barbeiro'
    const confirmed = appointments.filter((appointment) => appointment.status === 'confirmed')
    const cancelled = appointments.filter((appointment) => appointment.status === 'cancelled')
    const upcoming = confirmed
        .filter((appointment) => new Date(appointment.starts_at).getTime() >= now.getTime())
        .sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at))

    return (
        <main className="dashboard-home">
            <PageHeader
                eyebrow={formatDate(now)}
                title={`${greetingFor(hourInFortaleza(now))}, ${firstName}`}
                description={`Este é o resumo de hoje da ${profile?.name || 'sua barbearia'}.`}
                actions={(
                    <>
                        <Link className="ui-button ui-button--primary" to="/dashboard/agenda?novo=1"><Icon name="plus" />Novo agendamento</Link>
                        <Link className="ui-button ui-button--secondary" to="/dashboard/finance"><Icon name="wallet" />Registrar pagamento</Link>
                    </>
                )}
            />

            <OnboardingChecklist linkShared={linkShared} />

            {loading ? (
                <p className="dashboard-loading" role="status">Carregando o movimento de hoje...</p>
            ) : error ? (
                <div className="dashboard-panel dashboard-error">
                    <p role="alert">{error}</p>
                    <button className="ui-button ui-button--secondary" type="button" onClick={() => setRefreshKey((current) => current + 1)}>Tentar novamente</button>
                </div>
            ) : (
                <TodayMetrics appointments={appointments} confirmed={confirmed} cancelled={cancelled} financeSummary={financeSummary} />
            )}

            <div className="dashboard-overview-grid">
                {!loading && !error ? <UpcomingAppointments upcoming={upcoming} /> : <div />}
                <ShareBookingLink slug={profile?.slug} barbershopName={profile?.name} onShared={() => setLinkShared(true)} />
            </div>
        </main>
    )
}
