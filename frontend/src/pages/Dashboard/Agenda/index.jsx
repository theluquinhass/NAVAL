import { useCallback, useEffect, useRef, useState } from 'react'
import DatePicker from '../../../components/DatePicker.jsx'
import { useProfile } from '../../../hooks/useProfile.js'
import { listServices } from '../../../services/servicesApi.js'
import {
    createPrivateAppointment,
    getAppointments,
    getPublicAvailability
} from '../../../services/schedulingApi.js'
import {
    formatSelectedDate,
    formatTime,
    getDayRange,
    getLocalDateValue,
    shiftDate,
    toFortalezaIso
} from './agendaDateTime.js'
import './agenda.css'

const emptyForm = { customerName: '', customerPhone: '', serviceId: '', date: '', startsAt: '' }

function getStatus(status) {
    if (status === 'confirmed') return { label: 'Confirmado', className: 'agenda-status--confirmed' }
    if (status === 'cancelled') return { label: 'Cancelado', className: 'agenda-status--cancelled' }
    return { label: status, className: 'agenda-status--other' }
}

function getApiErrorMessage(error) {
    const status = error.response?.status
    if (status === 400) return error.response.data?.error || 'Confira os dados informados e tente novamente.'
    if (status === 401) return 'Sua sessão expirou ou não está autenticada. Entre novamente para continuar.'
    if (status === 404) return 'A barbearia ou o serviço selecionado não foi encontrado.'
    if (status === 409) return 'Esse horário acabou de ser ocupado. Atualize as opções e selecione outro horário.'
    if (status >= 500) return 'Não foi possível criar o agendamento agora. Tente novamente.'
    return error.response?.data?.error || error.message || 'Não foi possível concluir a solicitação.'
}

function validateForm(form, today, slots) {
    const errors = {}
    const name = form.customerName.trim()
    const phone = form.customerPhone.trim()
    const phoneDigits = phone.replace(/\D/g, '').length

    if (!name) errors.customerName = 'Informe o nome do cliente.'
    else if (name.length > 100) errors.customerName = 'Use no máximo 100 caracteres.'

    if (!phone) errors.customerPhone = 'Informe o telefone do cliente.'
    else if (phone.length > 25 || !/^\+?[0-9][0-9().\s-]*[0-9]$/.test(phone) || phoneDigits < 7 || phoneDigits > 15) {
        errors.customerPhone = 'Informe um telefone válido com 7 a 15 dígitos.'
    }

    if (!form.serviceId) errors.serviceId = 'Selecione um serviço.'
    if (!form.date) errors.date = 'Selecione uma data.'
    else if (form.date < today) errors.date = 'A data não pode ser anterior a hoje.'
    if (!form.startsAt) errors.startsAt = 'Selecione um horário disponível.'
    else if (!slots.includes(form.startsAt)) errors.startsAt = 'Selecione um horário disponível atualizado.'

    return errors
}

function CalendarIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
}

function CloseIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

export default function Agenda() {
    const profile = useProfile()
    const [selectedDate, setSelectedDate] = useState(getLocalDateValue)
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [formErrors, setFormErrors] = useState({})
    const [formMessage, setFormMessage] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [services, setServices] = useState([])
    const [servicesState, setServicesState] = useState('idle')
    const [shopSlug, setShopSlug] = useState('')
    const [availability, setAvailability] = useState([])
    const [availabilityState, setAvailabilityState] = useState('idle')
    const [availabilityError, setAvailabilityError] = useState('')
    const [availabilityRetry, setAvailabilityRetry] = useState(0)
    const dialogRef = useRef(null)
    const nameInputRef = useRef(null)
    const previousFocusRef = useRef(null)
    const today = getLocalDateValue()
    const maxBookingDate = shiftDate(today, 90)

    useEffect(() => {
        let active = true
        const { from, to } = getDayRange(selectedDate)
        getAppointments(from, to)
            .then((items) => { if (active) setAppointments(items) })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.error || requestError.message || 'Não foi possível carregar a agenda.')
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [selectedDate, refreshKey])

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return undefined

        if (modalOpen && !dialog.open) {
            previousFocusRef.current = document.activeElement
            dialog.showModal()
            nameInputRef.current?.focus()
        } else if (!modalOpen && dialog.open) {
            dialog.close()
            previousFocusRef.current?.focus()
        }
        return undefined
    }, [modalOpen])

    useEffect(() => {
        if (!modalOpen) return undefined
        let active = true
        listServices()
            .then((serviceList) => {
                if (!active) return
                setServices(serviceList)
                setShopSlug(profile?.slug || '')
                setServicesState('ready')
            })
            .catch((requestError) => {
                if (active) {
                    setServicesState('error')
                    setFormMessage(getApiErrorMessage(requestError))
                }
            })

        return () => { active = false }
    }, [modalOpen, profile?.slug])

    useEffect(() => {
        if (!modalOpen || servicesState !== 'ready' || !shopSlug || !form.serviceId || !form.date) {
            return undefined
        }

        let active = true
        getPublicAvailability(shopSlug, form.date, form.serviceId)
            .then((result) => {
                if (active) {
                    setAvailability(result.slots || [])
                    setAvailabilityState('ready')
                }
            })
            .catch((requestError) => {
                if (active) {
                    setAvailabilityError(getApiErrorMessage(requestError))
                    setAvailabilityState('error')
                }
            })
        return () => { active = false }
    }, [modalOpen, servicesState, shopSlug, form.date, form.serviceId, availabilityRetry])

    const closeModal = useCallback(() => {
        if (submitting) return
        setModalOpen(false)
        setForm(emptyForm)
        setFormErrors({})
        setFormMessage('')
    }, [submitting])

    function openModal() {
        const initialDate = selectedDate < today ? today : selectedDate
        setForm({ ...emptyForm, date: initialDate })
        setFormErrors({})
        setFormMessage('')
        setSuccessMessage('')
        setServices([])
        setServicesState('loading')
        setShopSlug('')
        setAvailability([])
        setAvailabilityState('idle')
        setAvailabilityError('')
        setAvailabilityRetry(0)
        setModalOpen(true)
    }

    function changeAgendaDate(date) {
        if (date === selectedDate) return
        setSelectedDate(date)
        setLoading(true)
        setError('')
    }

    function updateFormField(name, value) {
        setForm((current) => ({ ...current, [name]: value, ...(name === 'date' || name === 'serviceId' ? { startsAt: '' } : {}) }))
        setFormErrors((current) => ({
            ...current,
            [name]: '',
            ...(name === 'date' || name === 'serviceId' ? { startsAt: '' } : {})
        }))
        setFormMessage('')
        if (name === 'date' || name === 'serviceId') {
            const nextDate = name === 'date' ? value : form.date
            const nextServiceId = name === 'serviceId' ? value : form.serviceId
            setAvailability([])
            setAvailabilityError('')
            setAvailabilityState(nextDate && nextServiceId && servicesState === 'ready' && shopSlug ? 'loading' : 'idle')
        }
    }

    function updateField(event) {
        updateFormField(event.target.name, event.target.value)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (submitting) return

        const errors = validateForm(form, today, availability)
        setFormErrors(errors)
        setFormMessage('')
        if (Object.keys(errors).length > 0) return

        setSubmitting(true)
        try {
            const payload = {
                customerName: form.customerName.trim(),
                customerPhone: form.customerPhone.trim(),
                serviceId: form.serviceId,
                startsAt: toFortalezaIso(form.startsAt)
            }
            await createPrivateAppointment(payload)
            setModalOpen(false)
            setForm(emptyForm)
            setFormErrors({})
            setFormMessage('')
            setSelectedDate(form.date)
            setLoading(true)
            setError('')
            setRefreshKey((current) => current + 1)
            setSuccessMessage('Agendamento criado com sucesso.')
        } catch (requestError) {
            if (requestError.response?.status === 409) {
                setForm((current) => ({ ...current, startsAt: '' }))
                setAvailability([])
                setAvailabilityState('loading')
                setAvailabilityError('')
                setAvailabilityRetry((current) => current + 1)
                setFormErrors({ startsAt: 'Esse horário acabou de ser ocupado. Selecione outro horário.' })
            }
            setFormMessage(getApiErrorMessage(requestError))
        } finally {
            setSubmitting(false)
        }
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

            <dialog
                className="dashboard-agenda__dialog"
                ref={dialogRef}
                aria-labelledby="agenda-dialog-title"
                aria-describedby="agenda-dialog-description"
                onCancel={(event) => {
                    event.preventDefault()
                    closeModal()
                }}
            >
                <div className="dashboard-agenda__dialog-header">
                    <div>
                        <p className="dashboard-eyebrow">Novo atendimento</p>
                        <h2 id="agenda-dialog-title">Novo agendamento</h2>
                        <p id="agenda-dialog-description">Preencha os dados do cliente e escolha um horário disponível.</p>
                    </div>
                    <button className="dashboard-agenda__dialog-close" type="button" aria-label="Fechar formulário" onClick={closeModal} disabled={submitting}><CloseIcon /></button>
                </div>

                {servicesState === 'loading' ? (
                    <p className="dashboard-agenda__form-feedback" role="status">Carregando serviços...</p>
                ) : servicesState === 'error' ? (
                    <div className="dashboard-agenda__form-feedback dashboard-agenda__form-feedback--error" role="alert">{formMessage}</div>
                ) : services.length === 0 ? (
                    <p className="dashboard-agenda__form-feedback">Nenhum serviço cadastrado. Cadastre um serviço antes de agendar.</p>
                ) : (
                    <form className="dashboard-agenda__form" onSubmit={handleSubmit} noValidate>
                        <label className="dashboard-agenda__field" htmlFor="appointment-customer-name">
                            Nome do cliente
                            <input
                                ref={nameInputRef}
                                id="appointment-customer-name"
                                name="customerName"
                                value={form.customerName}
                                onChange={updateField}
                                maxLength={100}
                                autoComplete="name"
                                aria-invalid={Boolean(formErrors.customerName)}
                                aria-describedby={formErrors.customerName ? 'appointment-customer-name-error' : undefined}
                                required
                            />
                            {formErrors.customerName && <span className="dashboard-agenda__field-error" id="appointment-customer-name-error">{formErrors.customerName}</span>}
                        </label>

                        <label className="dashboard-agenda__field" htmlFor="appointment-customer-phone">
                            Telefone do cliente
                            <input
                                id="appointment-customer-phone"
                                name="customerPhone"
                                type="tel"
                                value={form.customerPhone}
                                onChange={updateField}
                                maxLength={25}
                                autoComplete="tel"
                                aria-invalid={Boolean(formErrors.customerPhone)}
                                aria-describedby={formErrors.customerPhone ? 'appointment-customer-phone-error' : undefined}
                                required
                            />
                            {formErrors.customerPhone && <span className="dashboard-agenda__field-error" id="appointment-customer-phone-error">{formErrors.customerPhone}</span>}
                        </label>

                        <label className="dashboard-agenda__field" htmlFor="appointment-service">
                            Serviço
                            <select
                                id="appointment-service"
                                name="serviceId"
                                value={form.serviceId}
                                onChange={updateField}
                                aria-invalid={Boolean(formErrors.serviceId)}
                                aria-describedby={formErrors.serviceId ? 'appointment-service-error' : undefined}
                                required
                            >
                                <option value="">Selecione um serviço</option>
                                {services.map((service) => <option value={service.id} key={service.id}>{service.name} — {Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>)}
                            </select>
                            {formErrors.serviceId && <span className="dashboard-agenda__field-error" id="appointment-service-error">{formErrors.serviceId}</span>}
                        </label>

                        <label className="dashboard-agenda__field" htmlFor="appointment-date">
                            Data
                            <DatePicker
                                id="appointment-date"
                                ariaLabel="Data do agendamento"
                                min={today}
                                max={maxBookingDate}
                                value={form.date}
                                onChange={(value) => updateFormField('date', value)}
                                invalid={Boolean(formErrors.date)}
                                describedBy={formErrors.date ? 'appointment-date-error' : undefined}
                                required
                            />
                            {formErrors.date && <span className="dashboard-agenda__field-error" id="appointment-date-error">{formErrors.date}</span>}
                        </label>

                        <label className="dashboard-agenda__field" htmlFor="appointment-time">
                            Horário
                            <select
                                id="appointment-time"
                                name="startsAt"
                                value={form.startsAt}
                                onChange={updateField}
                                disabled={!form.serviceId || !form.date || availabilityState === 'loading' || availabilityState === 'error' || availability.length === 0}
                                aria-invalid={Boolean(formErrors.startsAt)}
                                aria-describedby={formErrors.startsAt ? 'appointment-time-error' : availabilityError ? 'appointment-time-help' : undefined}
                                required
                            >
                                <option value="">{availabilityState === 'loading' ? 'Buscando horários...' : 'Selecione um horário'}</option>
                                {availability.map((slot) => <option value={slot} key={slot}>{formatTime(slot)}</option>)}
                            </select>
                            {formErrors.startsAt && <span className="dashboard-agenda__field-error" id="appointment-time-error">{formErrors.startsAt}</span>}
                            {availabilityError && <span className="dashboard-agenda__field-help dashboard-agenda__field-error" id="appointment-time-help">{availabilityError}</span>}
                            {availabilityState === 'ready' && availability.length === 0 && form.serviceId && form.date && <span className="dashboard-agenda__field-help">Não há horários disponíveis para este serviço nesta data.</span>}
                            {!shopSlug && servicesState === 'ready' && <span className="dashboard-agenda__field-error">Não foi possível identificar o endereço público da barbearia.</span>}
                        </label>

                        {formMessage && <p className="dashboard-agenda__form-message" role="alert">{formMessage}</p>}
                        <div className="dashboard-agenda__form-actions">
                            <button className="dashboard-agenda__cancel" type="button" onClick={closeModal} disabled={submitting}>Cancelar</button>
                            <button className="dashboard-agenda__submit" type="submit" disabled={submitting || availabilityState === 'loading' || !availability.length}>
                                {submitting ? 'Salvando...' : 'Criar agendamento'}
                            </button>
                        </div>
                    </form>
                )}
            </dialog>
        </main>
    )
}
