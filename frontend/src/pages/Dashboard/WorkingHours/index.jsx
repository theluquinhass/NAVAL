import { useEffect, useState } from 'react'
import { getWorkingHours, saveWorkingHours } from '../../../services/schedulingApi.js'
import { formatTimeInput, getErrorMessage, TIME_ZONE } from '../../../utils/dashboard.js'
import '../management.css'
import './workingHours.css'

const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const WEEKDAY_INDICES = [1, 2, 3, 4, 5]
const ALL_DAY_INDICES = weekdays.map((_, index) => index)
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function completeTime(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, 4)
    if (digits.length === 0) return ''
    return `${digits.slice(0, 2).padStart(2, '0')}:${digits.slice(2).padEnd(2, '0')}`
}

function dayTotalMinutes(day) {
    if (!day.enabled) return 0
    return day.periods.reduce((total, period) => {
        if (!TIME_PATTERN.test(period.opens_at) || !TIME_PATTERN.test(period.closes_at)) return total
        const [openHour, openMinute] = period.opens_at.split(':').map(Number)
        const [closeHour, closeMinute] = period.closes_at.split(':').map(Number)
        const minutes = (closeHour * 60 + closeMinute) - (openHour * 60 + openMinute)
        return minutes > 0 ? total + minutes : total
    }, 0)
}

function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    if (hours === 0) return `${remainder}min`
    return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}min`
}

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
        timeZone: TIME_ZONE
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

    function clearAllFeedback() {
        setSaveError('')
        setMessage('')
        setConflicts(null)
        setValidationErrors({})
    }

    function copySchedule(sourceDay, targetDays) {
        setDays((current) => {
            const source = current.find((day) => day.day_of_week === sourceDay)
            if (!source) return current
            const schedule = {
                enabled: source.enabled,
                periods: source.periods.map((period) => ({ ...period }))
            }
            return current.map((day) => (
                targetDays.includes(day.day_of_week) ? { ...day, ...schedule } : day
            ))
        })
        clearAllFeedback()
    }

    function closeDay(dayIndex) {
        setDays((current) => current.map((day) => (
            day.day_of_week === dayIndex ? { ...day, enabled: false, periods: [] } : day
        )))
        clearAllFeedback()
    }

    function updateTime(dayIndex, periodIndex, field, value) {
        updatePeriod(dayIndex, periodIndex, { [field]: formatTimeInput(value) })
    }

    function normalizeTime(dayIndex, periodIndex, field) {
        setDays((current) => current.map((day) => day.day_of_week === dayIndex
            ? {
                ...day,
                periods: day.periods.map((period, index) => index === periodIndex
                    ? { ...period, [field]: completeTime(period[field]) }
                    : period)
            }
            : day
        ))
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

    const openDays = days.filter((day) => day.enabled).length
    const totalMinutes = days.reduce((total, day) => total + dayTotalMinutes(day), 0)

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
                            <p className="working-hours__summary">{openDays} {openDays === 1 ? 'dia aberto' : 'dias abertos'} · {formatDuration(totalMinutes)} semanais</p>
                        </div>
                        <span className="working-hours__format">24 horas</span>
                    </div>

                    <div className="working-hours__column-labels" aria-hidden="true">
                        <span>Dia</span><span>Funcionamento</span><span>Períodos</span>
                    </div>

                    <div className="working-hours__days">
                        {days.map((day) => (
                            <fieldset
                                                className={`working-hours__day${day.enabled ? ' working-hours__day--open' : ''}`}
                                                key={day.day_of_week}
                                                aria-describedby={validationErrors[day.day_of_week] ? `working-day-${day.day_of_week}-error` : undefined}
                                            >
                                <legend>{weekdays[day.day_of_week]}</legend>
                                <div className="working-hours__day-status">
                                    <label className="working-hours__toggle" htmlFor={`working-day-${day.day_of_week}`}>
                                        <input
                                            id={`working-day-${day.day_of_week}`}
                                            type="checkbox"
                                            checked={day.enabled}
                                            onChange={(event) => updateDay(day.day_of_week, { enabled: event.target.checked })}
                                        />
                                        <span>Aberto</span>
                                    </label>
                                    <span className="working-hours__day-total">
                                        {day.enabled ? formatDuration(dayTotalMinutes(day)) : 'Fechado'}
                                    </span>
                                </div>

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
                                                        aria-invalid={Boolean(validationErrors[day.day_of_week])}
                                                        aria-describedby={validationErrors[day.day_of_week] ? `working-day-${day.day_of_week}-error` : undefined}
                                                        value={period.opens_at}
                                                        onChange={(event) => updateTime(day.day_of_week, periodIndex, 'opens_at', event.target.value)}
                                                        onBlur={() => normalizeTime(day.day_of_week, periodIndex, 'opens_at')}
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
                                                        aria-invalid={Boolean(validationErrors[day.day_of_week])}
                                                        aria-describedby={validationErrors[day.day_of_week] ? `working-day-${day.day_of_week}-error` : undefined}
                                                        value={period.closes_at}
                                                        onChange={(event) => updateTime(day.day_of_week, periodIndex, 'closes_at', event.target.value)}
                                                        onBlur={() => normalizeTime(day.day_of_week, periodIndex, 'closes_at')}
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
                                            <p className="working-hours__day-error" id={`working-day-${day.day_of_week}-error`} role="alert">{validationErrors[day.day_of_week]}</p>
                                        )}
                                        <button className="working-hours__add" type="button" onClick={() => addPeriod(day.day_of_week)}>
                                            <span aria-hidden="true">+</span> Adicionar período
                                        </button>
                                        <div className="working-hours__quick-actions" aria-label={`Ações rápidas para ${weekdays[day.day_of_week]}`}>
                                            <button
                                                className="working-hours__quick"
                                                type="button"
                                                onClick={() => copySchedule(day.day_of_week, WEEKDAY_INDICES)}
                                                aria-label={`Copiar horário de ${weekdays[day.day_of_week]} para segunda a sexta`}
                                            >
                                                Copiar para seg–sex
                                            </button>
                                            <button
                                                className="working-hours__quick"
                                                type="button"
                                                onClick={() => copySchedule(day.day_of_week, ALL_DAY_INDICES)}
                                                aria-label={`Copiar horário de ${weekdays[day.day_of_week]} para todos os dias`}
                                            >
                                                Copiar para todos
                                            </button>
                                            <button
                                                className="working-hours__quick working-hours__quick--close"
                                                type="button"
                                                onClick={() => closeDay(day.day_of_week)}
                                                aria-label={`Fechar ${weekdays[day.day_of_week]}`}
                                            >
                                                Fechar dia
                                            </button>
                                        </div>
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
                            <p>{conflicts.total} {conflicts.total === 1 ? 'agendamento confirmado ficará' : 'agendamentos confirmados ficarão'} fora dos novos períodos. Salvar não altera nem cancela essas reservas; novos agendamentos passarão a respeitar a grade salva.</p>
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
