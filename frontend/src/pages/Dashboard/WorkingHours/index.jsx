import { useEffect, useState } from 'react'
import { getWorkingHours, saveWorkingHours } from '../../../services/schedulingApi.js'
import '../management.css'
import './workingHours.css'

const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function createEmptyWeek() {
    return weekdays.map((_, day_of_week) => ({ day_of_week, enabled: false, periods: [] }))
}

function mapSavedHours(saved = []) {
    const week = createEmptyWeek()
    for (const row of [...saved].sort((a, b) => a.day_of_week - b.day_of_week || a.period_index - b.period_index)) {
        const day = week[row.day_of_week]
        if (!day) continue
        day.enabled = true
        day.periods.push({
            opens_at: row.opens_at?.slice(0, 5) ?? '',
            closes_at: row.closes_at?.slice(0, 5) ?? ''
        })
    }
    return week
}

function getErrorMessage(error, fallback) {
    return error.response?.data?.error || error.message || fallback
}

function getScheduleErrors(days) {
    const errors = {}

    for (const day of days.filter((item) => item.enabled)) {
        if (day.periods.length === 0) {
            errors[day.day_of_week] = 'Adicione pelo menos um período ou feche este dia.'
            continue
        }

        for (let index = 0; index < day.periods.length; index += 1) {
            const period = day.periods[index]
            if (!TIME_PATTERN.test(period.opens_at) || !TIME_PATTERN.test(period.closes_at)) {
                errors[day.day_of_week] = `Preencha início e término do período ${index + 1} no formato HH:mm.`
                break
            }
            if (period.opens_at >= period.closes_at) {
                errors[day.day_of_week] = `No período ${index + 1}, o início deve ser anterior ao término.`
                break
            }
            if (index > 0) {
                const previous = day.periods[index - 1]
                if (period.opens_at < previous.closes_at) {
                    errors[day.day_of_week] = `O período ${index + 1} se sobrepõe ao período anterior. Ajuste os horários ou remova o intervalo.`
                    break
                }
                if (period.opens_at < previous.opens_at) {
                    errors[day.day_of_week] = 'Ordene os períodos do dia pelo horário de início.'
                    break
                }
            }
        }
    }

    return errors
}

function formatAppointmentDate(value) {
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Fortaleza'
    }).format(new Date(value))
}

export default function WorkingHours() {
    const [days, setDays] = useState(createEmptyWeek)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [message, setMessage] = useState('')
    const [validationErrors, setValidationErrors] = useState({})
    const [conflicts, setConflicts] = useState(null)
    const [reloadToken, setReloadToken] = useState(0)

    useEffect(() => {
        let active = true

        getWorkingHours()
            .then((saved) => {
                if (active) {
                    setDays(mapSavedHours(Array.isArray(saved) ? saved : []))
                    setLoadError('')
                }
            })
            .catch((requestError) => {
                if (active) setLoadError(getErrorMessage(requestError, 'Não foi possível carregar os horários.'))
            })
            .finally(() => { if (active) setLoading(false) })

        return () => { active = false }
    }, [reloadToken])

    function clearFeedback(dayIndex) {
        setSaveError('')
        setMessage('')
        setConflicts(null)
        setValidationErrors((current) => {
            if (!Object.hasOwn(current, dayIndex)) return current
            const next = { ...current }
            delete next[dayIndex]
            return next
        })
    }

    function updateDay(dayIndex, changes) {
        setDays((current) => current.map((day) => {
            if (day.day_of_week !== dayIndex) return day
            const next = { ...day, ...changes }
            if (changes.enabled === true && next.periods.length === 0) {
                next.periods = [{ opens_at: '', closes_at: '' }]
            }
            return next
        }))
        clearFeedback(dayIndex)
    }

    function updatePeriod(dayIndex, periodIndex, changes) {
        setDays((current) => current.map((day) => day.day_of_week === dayIndex
            ? { ...day, periods: day.periods.map((period, index) => index === periodIndex ? { ...period, ...changes } : period) }
            : day
        ))
        clearFeedback(dayIndex)
    }

    function addPeriod(dayIndex) {
        setDays((current) => current.map((day) => day.day_of_week === dayIndex
            ? { ...day, enabled: true, periods: [...day.periods, { opens_at: '', closes_at: '' }] }
            : day
        ))
        clearFeedback(dayIndex)
    }

    function removePeriod(dayIndex, periodIndex) {
        setDays((current) => current.map((day) => day.day_of_week === dayIndex
            ? { ...day, periods: day.periods.filter((_, index) => index !== periodIndex) }
            : day
        ))
        clearFeedback(dayIndex)
    }

    async function saveSchedule(confirmConflicts = false) {
        if (saving) return
        const errors = getScheduleErrors(days)
        setValidationErrors(errors)
        setSaveError('')
        setMessage('')
        if (Object.keys(errors).length > 0) {
            setConflicts(null)
            return
        }

        const workingHours = days
            .filter((day) => day.enabled)
            .flatMap((day) => day.periods.map((period, period_index) => ({
                day_of_week: day.day_of_week,
                period_index,
                opens_at: period.opens_at,
                closes_at: period.closes_at
            })))

        setSaving(true)
        try {
            const saved = await saveWorkingHours(workingHours, { confirmConflicts })
            setDays(mapSavedHours(saved))
            setConflicts(null)
            setMessage('Horários salvos com sucesso.')
        } catch (error) {
            const response = error.response?.data
            if (error.response?.status === 409 && response?.code === 'WORKING_HOURS_CONFLICTS') {
                setConflicts({ items: response.conflicts ?? [], total: response.totalConflicts ?? response.conflicts?.length ?? 0 })
            } else {
                setSaveError(getErrorMessage(error, 'Não foi possível salvar os horários.'))
            }
        } finally {
            setSaving(false)
        }
    }

    function handleSubmit(event) {
        event.preventDefault()
        saveSchedule(false)
    }

    function retryLoad() {
        setLoading(true)
        setLoadError('')
        setReloadToken((current) => current + 1)
    }

    return (
        <main className="dashboard-management working-hours-page">
            <header className="dashboard-management__header">
                <p className="dashboard-eyebrow">Gestão</p>
                <h1>Horários de funcionamento</h1>
                <p>Defina em quais dias e horários sua barbearia atende.</p>
            </header>

            {loading ? (
                <section className="dashboard-management__panel working-hours__state" aria-busy="true" aria-live="polite">
                    <span className="working-hours__spinner" aria-hidden="true" />
                    <p>Carregando horários...</p>
                </section>
            ) : loadError ? (
                <section className="dashboard-management__panel working-hours__state working-hours__state--error" role="alert">
                    <h2>Não foi possível carregar os horários</h2>
                    <p>{loadError}</p>
                    <button className="dashboard-management__secondary" type="button" onClick={retryLoad}>Tentar novamente</button>
                </section>
            ) : (
                <form className="dashboard-management__panel working-hours" onSubmit={handleSubmit}>
                    <div className="dashboard-management__panel-heading working-hours__heading">
                        <div>
                            <h2>Semana de atendimento</h2>
                            <p>Configure um ou mais períodos por dia. Os intervalos entre eles ficam indisponíveis.</p>
                        </div>
                        <span className="working-hours__format">24 horas</span>
                    </div>

                    <div className="working-hours__column-labels" aria-hidden="true">
                        <span>Dia</span><span>Funcionamento</span><span>Períodos</span>
                    </div>

                    <div className="working-hours__days">
                        {days.map((day) => (
                            <fieldset className={`working-hours__day${day.enabled ? ' working-hours__day--open' : ''}`} key={day.day_of_week}>
                                <legend>{weekdays[day.day_of_week]}</legend>
                                <label className="working-hours__toggle" htmlFor={`working-day-${day.day_of_week}`}>
                                    <input
                                        id={`working-day-${day.day_of_week}`}
                                        type="checkbox"
                                        checked={day.enabled}
                                        onChange={(event) => updateDay(day.day_of_week, { enabled: event.target.checked })}
                                    />
                                    <span>Aberto</span>
                                </label>

                                {day.enabled ? (
                                    <div className="working-hours__periods">
                                        {day.periods.length === 0 && (
                                            <p className="working-hours__no-periods">Este dia está aberto, mas ainda não tem períodos. Adicione um período ou feche o dia.</p>
                                        )}
                                        {day.periods.map((period, periodIndex) => (
                                            <div className="working-hours__period" key={`${day.day_of_week}-${periodIndex}`}>
                                                <span className="working-hours__period-number">Período {periodIndex + 1}</span>
                                                <label className="working-hours__time" htmlFor={`working-open-${day.day_of_week}-${periodIndex}`}>
                                                    <span>Início</span>
                                                    <input
                                                        id={`working-open-${day.day_of_week}-${periodIndex}`}
                                                        type="text"
                                                        inputMode="numeric"
                                                        autoComplete="off"
                                                        maxLength={5}
                                                        placeholder="09:00"
                                                        aria-label={`${weekdays[day.day_of_week]}, período ${periodIndex + 1}, horário de início`}
                                                        value={period.opens_at}
                                                        onChange={(event) => updatePeriod(day.day_of_week, periodIndex, { opens_at: event.target.value })}
                                                    />
                                                </label>
                                                <label className="working-hours__time" htmlFor={`working-close-${day.day_of_week}-${periodIndex}`}>
                                                    <span>Término</span>
                                                    <input
                                                        id={`working-close-${day.day_of_week}-${periodIndex}`}
                                                        type="text"
                                                        inputMode="numeric"
                                                        autoComplete="off"
                                                        maxLength={5}
                                                        placeholder="12:00"
                                                        aria-label={`${weekdays[day.day_of_week]}, período ${periodIndex + 1}, horário de término`}
                                                        value={period.closes_at}
                                                        onChange={(event) => updatePeriod(day.day_of_week, periodIndex, { closes_at: event.target.value })}
                                                    />
                                                </label>
                                                <button
                                                    className="working-hours__remove"
                                                    type="button"
                                                    onClick={() => removePeriod(day.day_of_week, periodIndex)}
                                                    aria-label={`Remover período ${periodIndex + 1} de ${weekdays[day.day_of_week]}`}
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                        {validationErrors[day.day_of_week] && (
                                            <p className="working-hours__day-error" role="alert">{validationErrors[day.day_of_week]}</p>
                                        )}
                                        <button className="working-hours__add" type="button" onClick={() => addPeriod(day.day_of_week)}>
                                            <span aria-hidden="true">+</span> Adicionar período
                                        </button>
                                    </div>
                                ) : (
                                    <p className="working-hours__closed" aria-label={`${weekdays[day.day_of_week]} fechado`}>Fechado</p>
                                )}
                            </fieldset>
                        ))}
                    </div>

                    <div className="working-hours__footer">
                        <p className="working-hours__footer-hint">Agendamentos existentes são mantidos. Se algum ficar fora dos novos períodos, você poderá revisar antes de confirmar.</p>
                        <button className="dashboard-management__primary working-hours__save" type="submit" disabled={saving}>
                            {saving ? 'Salvando horários...' : 'Salvar horários'}
                        </button>
                    </div>

                    {conflicts && (
                        <section className="working-hours__conflicts" aria-labelledby="working-hours-conflicts-title" role="alert">
                            <h3 id="working-hours-conflicts-title">Revise os agendamentos afetados</h3>
                            <p>{conflicts.total} {conflicts.total === 1 ? 'agendamento confirmado ficará' : 'agendamentos confirmados ficarão'} fora dos novos períodos. Salvar não altera nem cancela essas reservas.</p>
                            {conflicts.items.length > 0 && (
                                <ul>
                                    {conflicts.items.map((appointment) => (
                                        <li key={appointment.id}>
                                            <strong>{appointment.customer_name}</strong> · {formatAppointmentDate(appointment.starts_at)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {conflicts.total > conflicts.items.length && <p>Exibindo {conflicts.items.length} de {conflicts.total} agendamentos.</p>}
                            <div className="dashboard-management__actions">
                                <button className="dashboard-management__secondary" type="button" onClick={() => setConflicts(null)} disabled={saving}>Revisar horários</button>
                                <button className="dashboard-management__primary" type="button" onClick={() => saveSchedule(true)} disabled={saving}>
                                    {saving ? 'Salvando...' : 'Salvar e manter agendamentos'}
                                </button>
                            </div>
                        </section>
                    )}

                    {saveError && <p className="dashboard-management__message dashboard-management__message--error working-hours__feedback" role="alert">{saveError}</p>}
                    {message && <p className="dashboard-management__message working-hours__feedback" role="status">{message}</p>}
                </form>
            )}
        </main>
    )
}
