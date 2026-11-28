import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import DatePicker from '../../components/DatePicker.jsx'
import Icon from '../../components/ui/Icon.jsx'
import { createAppointment, getPublicAvailability } from '../../services/schedulingApi.js'
import { addDays, fortalezaToday, formatMoney, getErrorMessage, TIME_ZONE } from '../../utils/dashboard.js'
import './booking.css'

const QUICK_DAYS = 7
const MOBILE_QUERY = '(max-width: 48rem)'
const DAY_PERIODS = [
    { key: 'morning', label: 'Manhã', test: (hour) => hour < 12 },
    { key: 'afternoon', label: 'Tarde', test: (hour) => hour >= 12 && hour < 18 },
    { key: 'evening', label: 'Noite', test: (hour) => hour >= 18 }
]

function formatTime(value) {
    if (!value) return '--:--'
    return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE })
}

function hourOf(value) {
    return Number(formatTime(value).slice(0, 2))
}

function formatDate(value) {
    if (!value) return 'Data não selecionada'
    return new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', timeZone: TIME_ZONE
    })
}

function dayChip(value, index) {
    const date = new Date(`${value}T12:00:00-03:00`)
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: TIME_ZONE }).replace('.', '')
    const day = date.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: TIME_ZONE })
    const label = index === 0 ? 'Hoje' : index === 1 ? 'Amanhã' : weekday
    return { value, label, day, full: formatDate(value) }
}

function revealDetailsOnPhones() {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia(MOBILE_QUERY).matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('booking-details')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

function StepTitle({ number, children }) {
    return (
        <span className="booking-step__title">
            <span className="booking-step__number" aria-hidden="true">{number}</span>
            {children}
        </span>
    )
}

function SlotPicker({ loading, serviceId, slots, startsAt, onPick }) {
    if (loading) return <p className="booking-empty">Buscando horários...</p>
    if (!serviceId) return <p className="booking-empty">Escolha um serviço para ver os horários.</p>
    if (slots.length === 0) return <p className="booking-empty">Nenhum horário disponível para esta data. Tente outro dia.</p>

    return (
        <div className="booking-slots" role="group" aria-label="Horários disponíveis">
            {DAY_PERIODS.map((period) => {
                const periodSlots = slots.filter((slot) => period.test(hourOf(slot)))
                if (periodSlots.length === 0) return null
                return (
                    <div className="booking-slots__period" key={period.key}>
                        <p className="booking-slots__period-label">{period.label}</p>
                        <div className="booking-slots__grid">
                            {periodSlots.map((slot) => (
                                <button
                                    key={slot}
                                    type="button"
                                    className={`booking-slot${startsAt === slot ? ' booking-slot--selected' : ''}`}
                                    aria-pressed={startsAt === slot}
                                    onClick={() => onPick(slot)}
                                >
                                    {formatTime(slot)}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function Confirmation({ confirmation, onRestart }) {
    const headingRef = useRef(null)
    // Move focus (and the viewport) to the result so phone users see it immediately.
    useEffect(() => { headingRef.current?.focus() }, [])

    return (
        <section className="booking-done" role="status" aria-labelledby="booking-done-title">
            <span className="booking-done__icon"><Icon name="check" /></span>
            <h2 id="booking-done-title" ref={headingRef} tabIndex={-1}>Agendamento confirmado!</h2>
            <p>Te esperamos na {confirmation.barbershop}. Chegue com alguns minutos de antecedência.</p>
            <dl className="booking-summary">
                <div><dt>Serviço</dt><dd>{confirmation.service}</dd></div>
                <div><dt>Dia</dt><dd>{confirmation.date}</dd></div>
                <div><dt>Horário</dt><dd>{confirmation.time}</dd></div>
                <div><dt>Valor</dt><dd>{confirmation.price}</dd></div>
            </dl>
            <button className="ui-button ui-button--secondary" type="button" onClick={onRestart}>Fazer outro agendamento</button>
        </section>
    )
}

export default function Booking() {
    const { slug } = useParams()
    const today = fortalezaToday()
    const [date, setDate] = useState(today)
    const [serviceId, setServiceId] = useState('')
    const [data, setData] = useState(null)
    const [services, setServices] = useState([])
    const [slots, setSlots] = useState([])
    const [startsAt, setStartsAt] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    // The first availability request (which also loads the catalog) starts on mount.
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [confirmation, setConfirmation] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)

    const selectedService = services.find((service) => service.id === serviceId)
    const barbershopName = data?.barbershop?.name
    const quickDays = Array.from({ length: QUICK_DAYS }, (_, index) => dayChip(addDays(today, index), index))

    useEffect(() => {
        let active = true
        getPublicAvailability(slug, date, serviceId)
            .then((response) => {
                if (!active) return
                setData(response)
                setServices(response.services ?? [])
                setSlots(response.slots ?? [])
                setError('')
            })
            .catch((requestError) => {
                if (!active) return
                setData(null)
                setSlots([])
                setError(getErrorMessage(requestError, 'Não foi possível carregar os horários.', {
                    404: 'Não encontramos esta barbearia. Confira o link que você recebeu.'
                }))
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [slug, date, serviceId, refreshKey])

    async function handleSubmit(event) {
        event.preventDefault()
        setSubmitting(true)
        setError('')
        try {
            await createAppointment(slug, { customerName, customerPhone, serviceId, startsAt })
            setConfirmation({
                barbershop: barbershopName || 'barbearia',
                service: selectedService?.name || 'Serviço',
                price: formatMoney(selectedService?.price),
                date: formatDate(date),
                time: formatTime(startsAt)
            })
            setStartsAt('')
            setCustomerName('')
            setCustomerPhone('')
            setLoading(true)
            setRefreshKey((current) => current + 1)
        } catch (requestError) {
            setError(getErrorMessage(requestError, 'Não foi possível confirmar o agendamento.', {
                409: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.'
            }))
            if (requestError?.response?.status === 409) {
                setStartsAt('')
                setRefreshKey((current) => current + 1)
            }
        } finally {
            setSubmitting(false)
        }
    }

    function clearAvailability() {
        setLoading(true)
        setError('')
        setSlots([])
        setStartsAt('')
        setConfirmation(null)
    }

    function handleServiceChange(value) {
        if (value === serviceId) return
        clearAvailability()
        setServiceId(value)
    }

    function handleDateChange(value) {
        if (!value || value === date) return
        clearAvailability()
        setDate(value)
    }

    function pickSlot(slot) {
        setStartsAt(slot)
        setError('')
        revealDetailsOnPhones()
    }

    const catalogFailed = !loading && !data && services.length === 0 && Boolean(error)

    return (
        <main className="booking">
            <header className="booking__hero">
                <span className="booking__brand"><span className="booking__mark" aria-hidden="true">N</span>Agendamento online</span>
                <h1>{barbershopName || 'Agende seu horário'}</h1>
                <p>Escolha o serviço, o dia e o horário. Leva menos de um minuto e não precisa ligar.</p>
            </header>

            {catalogFailed ? (
                <section className="booking-card booking-failure">
                    <p className="ui-alert" role="alert"><Icon name="alert" />{error}</p>
                    <button className="ui-button ui-button--secondary" type="button" onClick={() => { setLoading(true); setRefreshKey((current) => current + 1) }}>Tentar novamente</button>
                </section>
            ) : confirmation ? (
                <Confirmation confirmation={confirmation} onRestart={() => { setConfirmation(null); setError('') }} />
            ) : (
                <div className="booking__layout">
                    <div className="booking__steps">
                        <fieldset className="booking-card booking-step">
                            <legend><StepTitle number={1}>Escolha o serviço</StepTitle></legend>
                            {!loading && services.length === 0 ? (
                                <p className="booking-empty">Esta barbearia ainda não cadastrou serviços para agendamento online.</p>
                            ) : (
                                <div className="booking-services">
                                    {services.map((service) => (
                                        <label key={service.id} className={`booking-service${service.id === serviceId ? ' booking-service--selected' : ''}`}>
                                            <input type="radio" name="booking-service" value={service.id} checked={service.id === serviceId} onChange={() => handleServiceChange(service.id)} />
                                            <span className="booking-service__text">
                                                <strong>{service.name}</strong>
                                                {service.description && <small>{service.description}</small>}
                                                <small className="booking-service__duration"><Icon name="clock" />{service.duration} min</small>
                                            </span>
                                            <span className="booking-service__price">{formatMoney(service.price)}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </fieldset>

                        <section className="booking-card booking-step" aria-labelledby="booking-day-title">
                            <h2 id="booking-day-title"><StepTitle number={2}>Escolha o dia</StepTitle></h2>
                            <div className="booking-days" role="group" aria-label="Próximos dias">
                                {quickDays.map((day) => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        className={`booking-day${day.value === date ? ' booking-day--selected' : ''}`}
                                        aria-pressed={day.value === date}
                                        aria-label={day.full}
                                        onClick={() => handleDateChange(day.value)}
                                    >
                                        <span>{day.label}</span>
                                        <strong>{day.day}</strong>
                                    </button>
                                ))}
                            </div>
                            <div className="booking-field">
                                <label htmlFor="booking-date">Outra data</label>
                                <DatePicker id="booking-date" ariaLabel="Data do agendamento" min={today} value={date} onChange={handleDateChange} required />
                            </div>
                        </section>

                        <section className="booking-card booking-step" aria-labelledby="booking-time-title">
                            <h2 id="booking-time-title"><StepTitle number={3}>Escolha o horário</StepTitle></h2>
                            <p className="booking-step__hint">{formatDate(date)} · horário de Fortaleza</p>
                            <SlotPicker loading={loading} serviceId={serviceId} slots={slots} startsAt={startsAt} onPick={pickSlot} />
                        </section>
                    </div>

                    <section id="booking-details" className="booking-card booking-details" aria-labelledby="booking-details-title">
                        <h2 id="booking-details-title"><StepTitle number={4}>Confirme seus dados</StepTitle></h2>
                        <dl className="booking-summary" aria-label="Resumo do agendamento">
                            <div><dt>Serviço</dt><dd>{selectedService?.name || 'Não selecionado'}</dd></div>
                            <div><dt>Dia</dt><dd>{formatDate(date)}</dd></div>
                            <div><dt>Horário</dt><dd>{formatTime(startsAt)}</dd></div>
                            <div className="booking-summary__total"><dt>Valor</dt><dd>{selectedService ? formatMoney(selectedService.price) : '—'}</dd></div>
                        </dl>

                        <form className="booking-form" onSubmit={handleSubmit}>
                            {error && <p className="ui-alert" role="alert"><Icon name="alert" />{error}</p>}
                            <div className="booking-field">
                                <label htmlFor="booking-name">Seu nome</label>
                                <input id="booking-name" type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" placeholder="Nome completo" required />
                            </div>
                            <div className="booking-field">
                                <label htmlFor="booking-phone">Telefone (WhatsApp)</label>
                                <input id="booking-phone" type="tel" inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} autoComplete="tel" placeholder="(84) 99999-1234" required />
                            </div>
                            <button className="ui-button ui-button--primary ui-button--block booking-submit" type="submit" disabled={submitting || !startsAt}>
                                {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
                            </button>
                            {!startsAt && <p className="booking-form__hint">Escolha um horário para confirmar.</p>}
                        </form>
                    </section>
                </div>
            )}
        </main>
    )
}
