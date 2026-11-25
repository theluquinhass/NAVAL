import { useEffect, useState } from 'react'
import { getWorkingHours, saveWorkingHours } from '../../services/schedulingApi.js'
import './management.css'

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

    if (loading) return <main className="dashboard-management"><header className="dashboard-management__header"><p className="dashboard-eyebrow">Gestão</p><h1>Horários de funcionamento</h1><p>Defina em quais dias e horários sua barbearia atende.</p></header><section className="dashboard-management__panel"><p className="dashboard-management__empty">Carregando horários...</p></section></main>

    return (
        <main className="dashboard-management">
            <header className="dashboard-management__header">
                <p className="dashboard-eyebrow">Gestão</p>
                <h1>Horários de funcionamento</h1>
                <p>Defina em quais dias e horários sua barbearia atende.</p>
            </header>
            <form className="dashboard-management__panel working-hours" onSubmit={handleSubmit}>
                <div className="dashboard-management__panel-heading"><h2>Semana de atendimento</h2><p>Ative os dias de funcionamento e informe os horários.</p></div>
                {hours.map((day) => (
                    <fieldset className="working-hours__day" key={day.day_of_week}>
                        <legend>{weekdays[day.day_of_week]}</legend>
                        <label className="working-hours__toggle"><input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(day.day_of_week, { enabled: event.target.checked })} /><span>Aberto</span></label>
                        {day.enabled && <>
                            <label className="working-hours__time">Abre às <input type="time" value={day.opens_at} onChange={(event) => updateDay(day.day_of_week, { opens_at: event.target.value })} required /></label>
                            <label className="working-hours__time">Fecha às <input type="time" value={day.closes_at} onChange={(event) => updateDay(day.day_of_week, { closes_at: event.target.value })} required /></label>
                        </>}
                    </fieldset>
                ))}
                <div className="dashboard-management__actions"><button className="dashboard-management__primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar horários'}</button></div>
                {error && <p className="dashboard-management__message dashboard-management__message--error" role="alert">{error}</p>}
                {message && <p className="dashboard-management__message" role="status">{message}</p>}
            </form>
        </main>
    )
}
