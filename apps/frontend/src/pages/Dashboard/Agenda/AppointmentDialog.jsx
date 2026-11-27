import { useCallback, useEffect, useRef, useState } from 'react'
import DatePicker from '../../../components/DatePicker.jsx'
import { listServices } from '../../../services/servicesApi.js'
import { createPrivateAppointment, getPublicAvailability } from '../../../services/schedulingApi.js'
import { formatMoney, getErrorMessage, toFortalezaIso } from '../../../utils/dashboard.js'
import { AGENDA_ERROR_MESSAGES } from './agendaMessages.js'
import { formatTime, shiftDate } from './agendaDateTime.js'

const emptyForm = { customerName: '', customerPhone: '', serviceId: '', date: '', startsAt: '' }

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

function CloseIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

/**
 * Modal form for creating a private appointment. Mount it with a fresh `key` each time it
 * opens so the form, services and availability state start clean.
 */
export default function AppointmentDialog({ open, initialDate, today, profileSlug, onClose, onCreated }) {
    const [form, setForm] = useState(() => ({ ...emptyForm, date: initialDate }))
    const [formErrors, setFormErrors] = useState({})
    const [formMessage, setFormMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [services, setServices] = useState([])
    const [servicesState, setServicesState] = useState(open ? 'loading' : 'idle')
    const [shopSlug, setShopSlug] = useState('')
    const [availability, setAvailability] = useState([])
    const [availabilityState, setAvailabilityState] = useState('idle')
    const [availabilityError, setAvailabilityError] = useState('')
    const [availabilityRetry, setAvailabilityRetry] = useState(0)
    const dialogRef = useRef(null)
    const nameInputRef = useRef(null)
    const previousFocusRef = useRef(null)
    const maxBookingDate = shiftDate(today, 90)

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return undefined

        if (open && !dialog.open) {
            previousFocusRef.current = document.activeElement
            dialog.showModal()
            nameInputRef.current?.focus()
        } else if (!open && dialog.open) {
            dialog.close()
            previousFocusRef.current?.focus()
        }
        return undefined
    }, [open])

    useEffect(() => {
        if (!open) return undefined
        let active = true
        listServices()
            .then((serviceList) => {
                if (!active) return
                setServices(serviceList)
                setShopSlug(profileSlug || '')
                setServicesState('ready')
            })
            .catch((requestError) => {
                if (active) {
                    setServicesState('error')
                    setFormMessage(getErrorMessage(requestError, 'Não foi possível carregar os serviços.', AGENDA_ERROR_MESSAGES))
                }
            })

        return () => { active = false }
    }, [open, profileSlug])

    useEffect(() => {
        if (!open || servicesState !== 'ready' || !shopSlug || !form.serviceId || !form.date) {
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
                    setAvailabilityError(getErrorMessage(requestError, 'Não foi possível carregar os horários.', AGENDA_ERROR_MESSAGES))
                    setAvailabilityState('error')
                }
            })
        return () => { active = false }
    }, [open, servicesState, shopSlug, form.date, form.serviceId, availabilityRetry])

    const closeModal = useCallback(() => {
        if (submitting) return
        onClose()
    }, [submitting, onClose])

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
            onCreated(form.date)
        } catch (requestError) {
            if (requestError.response?.status === 409) {
                setForm((current) => ({ ...current, startsAt: '' }))
                setAvailability([])
                setAvailabilityState('loading')
                setAvailabilityError('')
                setAvailabilityRetry((current) => current + 1)
                setFormErrors({ startsAt: 'Esse horário acabou de ser ocupado. Selecione outro horário.' })
            }
            setFormMessage(getErrorMessage(requestError, 'Não foi possível concluir a solicitação.', AGENDA_ERROR_MESSAGES))
        } finally {
            setSubmitting(false)
        }
    }

    return (
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
                            {services.map((service) => <option value={service.id} key={service.id}>{service.name} — {formatMoney(service.price)}</option>)}
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
    )
}
