import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DatePicker from '../../../components/DatePicker.jsx'
import Icon from '../../../components/ui/Icon.jsx'
import PageHeader from '../../../components/ui/PageHeader.jsx'
import EmptyState from '../../../components/ui/EmptyState.jsx'
import { useToast } from '../../../components/ui/feedbackContext.js'
import { useProfile } from '../../../hooks/useProfile.js'
import { getAppointments } from '../../../services/schedulingApi.js'
import { fortalezaToday, getErrorMessage } from '../../../utils/dashboard.js'
import AppointmentDialog from './AppointmentDialog.jsx'
import { AGENDA_ERROR_MESSAGES } from './agendaMessages.js'
import {
    formatSelectedDate,
    formatTime,
    formatWeekday,
    formatWeekRange,
    getDayRange,
    getWeekDays,
    getWeekRange,
    shiftDate
} from './agendaDateTime.js'
import './agenda.css'

const VIEWS = [
    { id: 'day', label: 'Dia', step: 1 },
    { id: 'week', label: 'Semana', step: 7 }
]

function getStatus(status) {
    if (status === 'confirmed') return { label: 'Confirmado', className: 'agenda-status--confirmed', badge: 'success' }
    if (status === 'cancelled') return { label: 'Cancelado', className: 'agenda-status--cancelled', badge: 'danger' }
    return { label: status, className: 'agenda-status--other', badge: 'neutral' }
}

function DayList({ appointments }) {
    return (
        <ol className="dashboard-agenda__list">
            {appointments.map((appointment) => {
                const status = getStatus(appointment.status)
                return (
                    <li className={`dashboard-agenda__appointment ${status.className}`} key={appointment.id}>
                        <time className="dashboard-agenda__time" dateTime={appointment.starts_at}>{formatTime(appointment.starts_at)}</time>
                        <article className="dashboard-agenda__appointment-body">
                            <div className="dashboard-agenda__appointment-main">
                                <div>
                                    <h3>{appointment.customer_name}</h3>
                                    <p>{appointment.service?.name || 'Serviço indisponível'}</p>
                                </div>
                                <span className={`ui-badge ui-badge--${status.badge}`}>{status.label}</span>
                            </div>
                            <p className="dashboard-agenda__duration"><Icon name="clock" />{formatTime(appointment.starts_at)} – {formatTime(appointment.ends_at)}</p>
                        </article>
                    </li>
                )
            })}
        </ol>
    )
}

function WeekGrid({ selectedDate, today, appointments, onOpenDay }) {
    const days = getWeekDays(selectedDate)
    const byDay = new Map(days.map((day) => [day, []]))
    for (const appointment of appointments) {
        byDay.get(fortalezaToday(new Date(appointment.starts_at)))?.push(appointment)
    }

    return (
        <ol className="agenda-week">
            {days.map((day) => {
                const items = byDay.get(day)
                const confirmed = items.filter((item) => item.status === 'confirmed').length
                return (
                    <li key={day} className={`agenda-week__day${day === today ? ' agenda-week__day--today' : ''}`}>
                        <button type="button" className="agenda-week__header" onClick={() => onOpenDay(day)} aria-label={`Ver ${formatSelectedDate(day)}: ${confirmed} confirmados`}>
                            <span>{formatWeekday(day)}</span>
                            <strong>{confirmed}</strong>
                        </button>
                        {items.length === 0 ? (
                            <p className="agenda-week__free">Livre</p>
                        ) : (
                            <ul className="agenda-week__items">
                                {items.map((appointment) => {
                                    const status = getStatus(appointment.status)
                                    return (
                                        <li key={appointment.id} className={`agenda-week__item ${status.className}`}>
                                            <time dateTime={appointment.starts_at}>{formatTime(appointment.starts_at)}</time>
                                            <span>{appointment.customer_name}</span>
                                            {appointment.status === 'cancelled' && <small>Cancelado</small>}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </li>
                )
            })}
        </ol>
    )
}

export default function Agenda() {
    const profile = useProfile()
    const notify = useToast()
    const [searchParams, setSearchParams] = useSearchParams()
    const [view, setView] = useState('day')
    const [selectedDate, setSelectedDate] = useState(fortalezaToday)
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)
    // `?novo=1` (from the dashboard shortcut) opens the dialog right away.
    const [modalOpen, setModalOpen] = useState(() => searchParams.get('novo') === '1')
    const [dialogSession, setDialogSession] = useState(0)
    const today = fortalezaToday()
    const currentView = VIEWS.find((item) => item.id === view)

    useEffect(() => {
        if (searchParams.get('novo') !== '1') return
        const next = new URLSearchParams(searchParams)
        next.delete('novo')
        setSearchParams(next, { replace: true })
    }, [searchParams, setSearchParams])

    useEffect(() => {
        let active = true
        const { from, to } = view === 'week' ? getWeekRange(selectedDate) : getDayRange(selectedDate)
        getAppointments(from, to)
            .then((items) => { if (active) setAppointments(items) })
            .catch((requestError) => {
                if (active) setError(getErrorMessage(requestError, 'Não foi possível carregar a agenda.', AGENDA_ERROR_MESSAGES))
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [selectedDate, view, refreshKey])

    const closeModal = useCallback(() => setModalOpen(false), [])

    const handleCreated = useCallback((date) => {
        setModalOpen(false)
        setSelectedDate(date)
        setLoading(true)
        setError('')
        setRefreshKey((current) => current + 1)
        notify('Agendamento criado com sucesso.')
    }, [notify])

    function openModal() {
        setDialogSession((current) => current + 1)
        setModalOpen(true)
    }

    function reload(change) {
        setLoading(true)
        setError('')
        change()
    }

    function changeAgendaDate(date) {
        if (!date || date === selectedDate) return
        reload(() => setSelectedDate(date))
    }

    function changeView(nextView) {
        if (nextView === view) return
        reload(() => setView(nextView))
    }

    function openDay(date) {
        reload(() => {
            setView('day')
            setSelectedDate(date)
        })
    }

    const confirmedCount = appointments.filter((appointment) => appointment.status === 'confirmed').length
    const title = view === 'week' ? formatWeekRange(selectedDate) : formatSelectedDate(selectedDate)

    return (
        <main className="dashboard-agenda">
            <PageHeader
                eyebrow="Atendimento"
                title="Agenda"
                description="Veja quem vem hoje, navegue pelos dias e marque horários para seus clientes."
                actions={(
                    <button className="ui-button ui-button--primary" type="button" onClick={openModal}>
                        <Icon name="plus" />Novo agendamento
                    </button>
                )}
            />

            <section className="dashboard-agenda__panel" aria-label={view === 'week' ? 'Agenda semanal' : 'Agenda diária'}>
                <div className="dashboard-agenda__toolbar">
                    <div className="agenda-views" role="group" aria-label="Visualização">
                        {VIEWS.map((item) => (
                            <button key={item.id} type="button" aria-pressed={view === item.id} className={`agenda-views__option${view === item.id ? ' agenda-views__option--active' : ''}`} onClick={() => changeView(item.id)}>
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="dashboard-agenda__date-nav">
                        <button type="button" className="ui-icon-button" aria-label={view === 'week' ? 'Semana anterior' : 'Dia anterior'} onClick={() => changeAgendaDate(shiftDate(selectedDate, -currentView.step))}><Icon name="chevronLeft" /></button>
                        <button type="button" className="ui-button ui-button--secondary" onClick={() => changeAgendaDate(today)}>Hoje</button>
                        <button type="button" className="ui-icon-button" aria-label={view === 'week' ? 'Próxima semana' : 'Próximo dia'} onClick={() => changeAgendaDate(shiftDate(selectedDate, currentView.step))}><Icon name="chevronRight" /></button>
                    </div>
                    <div className="dashboard-agenda__date-picker">
                        <DatePicker compact ariaLabel="Selecionar data da agenda" value={selectedDate} onChange={changeAgendaDate} />
                    </div>
                </div>

                <div className="dashboard-agenda__title-row">
                    <h2>{title}</h2>
                    {!loading && !error && <span className="ui-badge ui-badge--brand">{confirmedCount} {confirmedCount === 1 ? 'confirmado' : 'confirmados'}</span>}
                </div>

                <div className="dashboard-agenda__content" aria-live="polite">
                    {loading ? (
                        <p className="dashboard-agenda__feedback">Carregando atendimentos...</p>
                    ) : error ? (
                        <div className="dashboard-agenda__feedback dashboard-agenda__feedback--error" role="alert">
                            <p>{error}</p>
                            <button type="button" className="ui-button ui-button--secondary" onClick={() => reload(() => setRefreshKey((current) => current + 1))}>Tentar novamente</button>
                        </div>
                    ) : view === 'week' ? (
                        <WeekGrid selectedDate={selectedDate} today={today} appointments={appointments} onOpenDay={openDay} />
                    ) : appointments.length === 0 ? (
                        <EmptyState
                            icon="calendar"
                            title="Dia livre por aqui"
                            action={<button type="button" className="ui-button ui-button--secondary" onClick={openModal}><Icon name="plus" />Marcar um horário</button>}
                        >
                            Não há atendimentos marcados para esta data.
                        </EmptyState>
                    ) : (
                        <DayList appointments={appointments} />
                    )}
                </div>
            </section>

            <AppointmentDialog
                key={dialogSession}
                open={modalOpen}
                initialDate={selectedDate < today ? today : selectedDate}
                today={today}
                profileSlug={profile?.slug}
                onClose={closeModal}
                onCreated={handleCreated}
            />
        </main>
    )
}
