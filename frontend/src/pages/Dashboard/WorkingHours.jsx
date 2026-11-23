import { useEffect, useState } from 'react'
import { getWorkingHours, saveWorkingHours } from '../../services/schedulingApi.js'

const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const defaultHours = weekdays.map((_, day_of_week) => ({ day_of_week, opens_at: '09:00', closes_at: '18:00', enabled: day_of_week > 0 && day_of_week < 6 }))

export default function WorkingHours() {
    const [hours, setHours] = useState(defaultHours)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        let active = true
        getWorkingHours()
            .then((saved) => {
                if (!active || saved.length === 0) return
                setHours(defaultHours.map((day) => {
                    const found = saved.find((row) => row.day_of_week === day.day_of_week)
                    return found ? { ...day, ...found, enabled: true } : { ...day, enabled: false }
                }))
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.error || requestError.message)
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])

    function updateDay(dayIndex, changes) {
        setHours((current) => current.map((day) => day.day_of_week === dayIndex ? { ...day, ...changes } : day))
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setError('')
        setMessage('')
        try {
            await saveWorkingHours(hours.filter((day) => day.enabled).map(({ day_of_week, opens_at, closes_at }) => ({ day_of_week, opens_at, closes_at })))
            setMessage('Horários salvos com sucesso.')
        } catch (requestError) {
            setError(requestError.response?.data?.error || requestError.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <section><h2>Horários de funcionamento</h2><p>Carregando horários...</p></section>

    return (
        <section>
            <h2>Horários de funcionamento</h2>
            <form onSubmit={handleSubmit}>
                {hours.map((day) => (
                    <fieldset key={day.day_of_week}>
                        <legend>{weekdays[day.day_of_week]}</legend>
                        <label>
                            <input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(day.day_of_week, { enabled: event.target.checked })} />
                            Aberto
                        </label>
                        {day.enabled && <>
                            <label>Abre às <input type="time" value={day.opens_at} onChange={(event) => updateDay(day.day_of_week, { opens_at: event.target.value })} required /></label>
                            <label>Fecha às <input type="time" value={day.closes_at} onChange={(event) => updateDay(day.day_of_week, { closes_at: event.target.value })} required /></label>
                        </>}
                    </fieldset>
                ))}
                <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar horários'}</button>
            </form>
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
        </section>
    )
}
