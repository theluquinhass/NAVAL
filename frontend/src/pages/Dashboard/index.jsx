import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'
import { dashboardMetrics, demoAppointments, demoDayProgress } from './mockDashboardData.js'
import './dashboard.css'

const icons = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>
}

function Icon({ name }) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

function formatDate(date) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export default function Dashboard() {
    const { loading } = useAuth()
    const [profile, setProfile] = useState(null)
    const today = new Date()

    useEffect(() => {
        let active = true
        api.get('/profile')
            .then((response) => { if (active) setProfile(response.data) })
            .catch((error) => console.log(error.response?.data || error.message))
        return () => { active = false }
    }, [])

    if (loading) return <p className="dashboard-loading">Carregando dashboard...</p>

    const profileName = profile?.profile?.name || 'Barbeiro'
    const greeting = today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite'

    return (
        <main className="dashboard-home">
            <header className="dashboard-welcome">
                <div>
                    <p className="dashboard-eyebrow">{formatDate(today)}</p>
                    <h1>{greeting}, {profileName}</h1>
                    <p className="dashboard-welcome__copy">Aqui está o resumo do movimento da sua barbearia hoje.</p>
                </div>
            </header>

            <section className="dashboard-metrics" aria-label="Indicadores de hoje">
                {dashboardMetrics.map((metric) => (
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
                    <div className="dashboard-appointment-list">
                        {demoAppointments.map((appointment) => (
                            <article className="dashboard-appointment" key={appointment.id}>
                                <time className="dashboard-appointment__time">{appointment.time}</time>
                                <div className="dashboard-appointment__person"><strong>{appointment.customer}</strong><span>{appointment.service}</span></div>
                                <span className={`dashboard-status${appointment.status === 'Pendente' ? ' dashboard-status--pending' : ''}`}>{appointment.status}</span>
                            </article>
                        ))}
                    </div>
                    <p className="dashboard-demo-note">Dados de demonstração</p>
                </section>

                <section className="dashboard-panel dashboard-progress" aria-labelledby="progress-title">
                    <div className="dashboard-panel__heading">
                        <div><p className="dashboard-eyebrow">Hoje</p><h2 id="progress-title">Andamento dos atendimentos</h2></div>
                    </div>
                    <div className="dashboard-progress__summary"><strong>{demoDayProgress.completed} de {demoDayProgress.total}</strong><span>atendimentos concluídos</span></div>
                    <div className="dashboard-progress__track" role="img" aria-label={`${demoDayProgress.completed} de ${demoDayProgress.total} atendimentos concluídos`}>
                        <span style={{ width: `${(demoDayProgress.completed / demoDayProgress.total) * 100}%` }} />
                    </div>
                    <div className="dashboard-progress__legend">
                        <span><i className="dashboard-progress__dot dashboard-progress__dot--done" />Concluídos <strong>{demoDayProgress.completed}</strong></span>
                        <span><i className="dashboard-progress__dot dashboard-progress__dot--pending" />Restantes <strong>{demoDayProgress.remaining}</strong></span>
                    </div>
                    <p className="dashboard-demo-note">Resumo ilustrativo</p>
                </section>
            </div>

            <div className="dashboard-agenda-access">
                <span>Precisa ver todos os horários do dia?</span>
                <Link to="/dashboard/agenda">Agenda completa <Icon name="arrow" /></Link>
            </div>
        </main>
    )
}
