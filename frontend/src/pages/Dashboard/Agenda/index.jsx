import { useCallback, useEffect, useState } from 'react'
import DatePicker from '../../../components/DatePicker.jsx'
import { useProfile } from '../../../hooks/useProfile.js'
import { getAppointments } from '../../../services/schedulingApi.js'
import { fortalezaToday, getErrorMessage } from '../../../utils/dashboard.js'
import AppointmentDialog from './AppointmentDialog.jsx'
import { AGENDA_ERROR_MESSAGES } from './agendaMessages.js'
import { formatSelectedDate, formatTime, getDayRange, shiftDate } from './agendaDateTime.js'
import './agenda.css'

function getStatus(status) {
    if (status === 'confirmed') return { label: 'Confirmado', className: 'agenda-status--confirmed' }
    if (status === 'cancelled') return { label: 'Cancelado', className: 'agenda-status--cancelled' }
    return { label: status, className: 'agenda-status--other' }
}

function CalendarIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
}

export default function Agenda() {
    const profile = useProfile()
    const [selectedDate, setSelectedDate] = useState(fortalezaToday)
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)
    const [modalOpen, setModalOpen] = useState(false)
    const [dialogSession, setDialogSession] = useState(0)
    const [successMessage, setSuccessMessage] = useState('')
    const today = fortalezaToday()

    useEffect(() => {
        let active = true
        const { from, to } = getDayRange(selectedDate)
        getAppointments(from, to)
            .then((items) => { if (active) setAppointments(items) })
            .catch((requestError) => {
                if (active) setError(getErrorMessage(requestError, 'Não foi possível carregar a agenda.', AGENDA_ERROR_MESSAGES))
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [selectedDate, refreshKey])

    const closeModal = useCallback(() => setModalOpen(false), [])

    const handleCreated = useCallback((date) => {
        setModalOpen(false)
        setSelectedDate(date)
        setLoading(true)
        setError('')
        setRefreshKey((current) => current + 1)
        setSuccessMessage('Agendamento criado com sucesso.')
    }, [])

    function openModal() {
        setSuccessMessage('')
        setDialogSession((current) => current + 1)
        setModalOpen(true)
    }

    function changeAgendaDate(date) {
        if (date === selectedDate) return
        setSelectedDate(date)
        setLoading(true)
        setError('')
    }

    return (
        <main className="dashboard-agenda">
            <header className="dashboard-agenda__header">
                <div>
                    <p className="dashboard-eyebrow">Gestão</p>
                    <h1>Agenda</h1>
                    <p>Acompanhe os atendimentos marcados para cada dia.</p>
                </div>
                <button className="dashboard-agenda__new" type="button" onClick={openModal}>
                    <span aria-hidden="true">＋</span> Novo agendamento
                </button>
            </header>

            {successMessage && <p className="dashboard-agenda__success" role="status">{successMessage}</p>}

            <section className="dashboard-agenda__panel" aria-label="Agenda diária">
                <div className="dashboard-agenda__toolbar">
                    <div className="dashboard-agenda__date-nav">
                        <button type="button" aria-label="Dia anterior" onClick={() => changeAgendaDate(shiftDate(selectedDate, -1))}>‹</button>
                        <button type="button" aria-label="Próximo dia" onClick={() => changeAgendaDate(shiftDate(selectedDate, 1))}>›</button>
                        <button className="dashboard-agenda__today" type="button" onClick={() => changeAgendaDate(today)}>Hoje</button>
                    </div>
                    <div className="dashboard-agenda__selected-date">
                        <CalendarIcon />
                        <h2>{formatSelectedDate(selectedDate)}</h2>
                    </div>
                    <div className="dashboard-agenda__date-picker">
                        <DatePicker compact ariaLabel="Selecionar data da agenda" value={selectedDate} onChange={changeAgendaDate} />
                    </div>
                </div>

                <div className="dashboard-agenda__content" aria-live="polite">
                    {loading ? (
                        <p className="dashboard-agenda__feedback">Carregando atendimentos...</p>
                    ) : error ? (
                        <div className="dashboard-agenda__feedback dashboard-agenda__feedback--error" role="alert">{error}</div>
                    ) : appointments.length === 0 ? (
                        <div className="dashboard-agenda__empty">
                            <span className="dashboard-agenda__empty-icon"><CalendarIcon /></span>
                            <h3>Dia livre por aqui</h3>
                            <p>Não há atendimentos marcados para esta data.</p>
                        </div>
                    ) : (
                        <ol className="dashboard-agenda__list">
                            {appointments.map((appointment) => {
                                const status = getStatus(appointment.status)
                                return (
                                    <li className={`dashboard-agenda__appointment ${status.className}`} key={appointment.id}>
                                        <time className="dashboard-agenda__time" dateTime={appointment.starts_at}>{formatTime(appointment.starts_at)}</time>
                                        <span className="dashboard-agenda__marker" aria-hidden="true" />
                                        <article className="dashboard-agenda__appointment-body">
                                            <div className="dashboard-agenda__appointment-main">
                                                <div>
                                                    <h3>{appointment.customer_name}</h3>
                                                    <p>{appointment.service?.name || 'Serviço indisponível'}</p>
                                                </div>
                                                <span className={`dashboard-agenda__status ${status.className}`}>{status.label}</span>
                                            </div>
                                            <p className="dashboard-agenda__duration">{formatTime(appointment.starts_at)} – {formatTime(appointment.ends_at)}</p>
                                        </article>
                                    </li>
                                )
                            })}
                        </ol>
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
