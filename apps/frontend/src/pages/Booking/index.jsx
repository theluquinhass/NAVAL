import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import DatePicker from '../../components/DatePicker.jsx'
import { createAppointment, getPublicAvailability } from '../../services/schedulingApi.js'
import { fortalezaToday, formatMoney, getErrorMessage, TIME_ZONE } from '../../utils/dashboard.js'
import './booking.css'

function formatTime(value) {
    if (!value) return '--:--'
    return new Date(value).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TIME_ZONE
    })
}

function formatDate(value) {
    if (!value) return 'Data não selecionada'
    return new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: TIME_ZONE
    })
}

export default function Booking() {
    const { slug } = useParams()
    const [date, setDate] = useState(fortalezaToday())
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
                setError(getErrorMessage(requestError, 'Não foi possível carregar os horários.'))
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
            setError(getErrorMessage(requestError, 'Não foi possível confirmar o agendamento.'))
        } finally {
            setSubmitting(false)
        }
    }

    function clearAvailability() {
        setLoading(true)
        setError('')
        setData(null)
        setSlots([])
        setStartsAt('')
        setConfirmation(null)
    }

    function handleServiceChange(value) {
        clearAvailability()
        setServiceId(value)
    }

    function handleDateChange(value) {
        clearAvailability()
        setDate(value)
    }

    function startOver() {
        setConfirmation(null)
        setStartsAt('')
        setError('')
    }

    return (
        <main className="booking-page">
            <header className="booking-header">
                <div className="booking-header__brand">
                    <span className="booking-header__mark" aria-hidden="true">N</span>
                    <span className="booking-header__eyebrow">NAVAL</span>
                </div>
                <p className="booking-header__eyebrow">Agendamento online</p>
                <h1>{data?.barbershop?.name || 'Agende seu horário'}</h1>
                <p>Escolha o serviço, a data e o horário. É rápido e sem precisar ligar.</p>
            </header>

            <div className="booking-grid">
                <section className="booking-card" aria-labelledby="booking-schedule-title">
                    <div className="booking-card__heading">
                        <span className="booking-card__step" aria-hidden="true">1</span>
                        <div>
                            <h2 id="booking-schedule-title">Serviço e horário</h2>
                            <p>Selecione quando deseja ser atendido.</p>
                        </div>
                    </div>

                    <div className="booking-fields">
                        <div className="booking-field">
                            <label htmlFor="booking-service">Serviço</label>
                            <select
                                id="booking-service"
                                value={serviceId}
                                onChange={(event) => handleServiceChange(event.target.value)}
                                required
                            >
                                <option value="">Selecione um serviço</option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.name} — {formatMoney(service.price)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="booking-field">
                            <label htmlFor="booking-date">Data</label>
                            <DatePicker
                                id="booking-date"
                                ariaLabel="Data do agendamento"
                                min={fortalezaToday()}
                                value={date}
                                onChange={handleDateChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="booking-slots-block">
                        <div className="booking-slots__heading">
                            <span>Horários disponíveis</span>
                            <small>Fuso: {TIME_ZONE}</small>
                        </div>

                        {loading ? (
                            <p className="booking-empty">Buscando horários...</p>
                        ) : !serviceId ? (
                            <p className="booking-empty">Escolha um serviço para ver os horários.</p>
                        ) : slots.length === 0 ? (
                            <p className="booking-empty">Nenhum horário disponível para esta data. Tente outro dia.</p>
                        ) : (
                            <div className="booking-slots" role="group" aria-label="Horários disponíveis">
                                {slots.map((slot) => (
                                    <button
                                        key={slot}
                                        type="button"
                                        className={`booking-slot${startsAt === slot ? ' booking-slot--selected' : ''}`}
                                        aria-pressed={startsAt === slot}
                                        onClick={() => { setStartsAt(slot); setError('') }}
                                    >
                                        {formatTime(slot)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="booking-card" aria-labelledby="booking-customer-title">
                    <div className="booking-card__heading">
                        <span className="booking-card__step" aria-hidden="true">2</span>
                        <div>
                            <h2 id="booking-customer-title">Seus dados</h2>
                            <p>Enviaremos a confirmação para o telefone informado.</p>
                        </div>
                    </div>

                    <div className="booking-summary" aria-label="Resumo do agendamento">
                        <div><span>Serviço</span><strong>{selectedService?.name || 'Não selecionado'}</strong></div>
                        <div><span>Data</span><strong>{formatDate(date)}</strong></div>
                        <div><span>Horário</span><strong>{formatTime(startsAt)}</strong></div>
                        <div><span>Valor</span><strong>{selectedService ? formatMoney(selectedService.price) : '—'}</strong></div>
                    </div>

                    {confirmation ? (
                        <div className="booking-confirmation" role="status">
                            <h3>Agendamento confirmado!</h3>
                            <p>{confirmation.service} · {confirmation.date} às {confirmation.time}</p>
                            <p>Valor: {confirmation.price}</p>
                            <button className="booking-secondary" type="button" onClick={startOver}>Fazer outro agendamento</button>
                        </div>
                    ) : (
                        <form className="booking-form" onSubmit={handleSubmit}>
                            {error && <p className="booking-feedback booking-feedback--error" role="alert">{error}</p>}

                            <div className="booking-field">
                                <label htmlFor="booking-name">Seu nome</label>
                                <input
                                    id="booking-name"
                                    type="text"
                                    value={customerName}
                                    onChange={(event) => setCustomerName(event.target.value)}
                                    autoComplete="name"
                                    placeholder="Nome completo"
                                    required
                                />
                            </div>

                            <div className="booking-field">
                                <label htmlFor="booking-phone">Telefone</label>
                                <input
                                    id="booking-phone"
                                    type="tel"
                                    value={customerPhone}
                                    onChange={(event) => setCustomerPhone(event.target.value)}
                                    autoComplete="tel"
                                    placeholder="(84) 99999-1234"
                                    required
                                />
                            </div>

                            <button className="booking-submit" type="submit" disabled={submitting || !startsAt}>
                                {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
                            </button>
                        </form>
                    )}
                </section>
            </div>
        </main>
    )
}
