import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createAppointment, getPublicAvailability } from '../../services/schedulingApi.js'

function localDate() {
    const now = new Date()
    const offset = now.getTimezoneOffset() * 60_000
    return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default function Booking() {
    const { slug } = useParams()
    const [date, setDate] = useState(localDate())
    const [serviceId, setServiceId] = useState('')
    const [data, setData] = useState(null)
    const [slots, setSlots] = useState([])
    const [startsAt, setStartsAt] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        let active = true
        if (!serviceId) {
            return () => { active = false }
        }
        getPublicAvailability(slug, date, serviceId)
            .then((response) => {
                if (active) {
                    setData(response)
                    setSlots(response.slots)
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.error || requestError.message)
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [slug, date, serviceId])

    useEffect(() => {
        let active = true
        getPublicAvailability(slug, date, '')
            .then((response) => { if (active) setData(response) })
            .catch((requestError) => { if (active) setError(requestError.response?.data?.error || requestError.message) })
        return () => { active = false }
    }, [slug, date])

    async function handleSubmit(event) {
        event.preventDefault()
        setSubmitting(true)
        setError('')
        setMessage('')
        try {
            await createAppointment(slug, { customerName, customerPhone, serviceId, startsAt })
            setMessage('Agendamento confirmado!')
            setStartsAt('')
            const refreshed = await getPublicAvailability(slug, date, serviceId)
            setSlots(refreshed.slots)
        } catch (requestError) {
            setError(requestError.response?.data?.error || requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main>
            <h1>Agendar horário</h1>
            {data?.barbershop && <h2>{data.barbershop.name}</h2>}
            <label>Serviço
                <select value={serviceId} onChange={(event) => {
                    setServiceId(event.target.value)
                    setStartsAt('')
                    setError('')
                    setLoading(Boolean(event.target.value))
                    if (!event.target.value) setSlots([])
                }} required>
                    <option value="">Selecione um serviço</option>
                    {data?.services?.map((service) => <option key={service.id} value={service.id}>{service.name} — R$ {service.price}</option>)}
                </select>
            </label>
            <label>Data <input type="date" min={localDate()} value={date} onChange={(event) => {
                setDate(event.target.value)
                setStartsAt('')
                setError('')
                setLoading(Boolean(serviceId))
            }} required /></label>
            {loading ? <p>Buscando horários...</p> : serviceId && <label>Horário
                <select value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required>
                    <option value="">Selecione um horário</option>
                    {slots.map((slot) => <option key={slot} value={slot}>{new Date(slot).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' })}</option>)}
                </select>
            </label>}
            <form onSubmit={handleSubmit}>
                <label>Seu nome <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></label>
                <label>Telefone <input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required /></label>
                <button type="submit" disabled={submitting || !startsAt}>{submitting ? 'Confirmando...' : 'Confirmar agendamento'}</button>
            </form>
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
        </main>
    )
}
