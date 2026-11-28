import { useEffect, useState } from 'react'
import { getWorkingHours, saveWorkingHours } from '../../../services/schedulingApi.js'
import { formatTimeInput, getErrorMessage } from '../../../utils/dashboard.js'
import ConflictsReview from './ConflictsReview.jsx'
import WorkingDayFieldset from './WorkingDayFieldset.jsx'
import {
    completeTime,
    dayTotalMinutes,
    formatDuration,
    createEmptyWeek,
    mapSavedHours,
    getScheduleErrors
} from './scheduleUtils.js'
import '../management.css'
import './workingHours.css'

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

    const dayActions = { updateDay, updateTime, normalizeTime, addPeriod, removePeriod, copySchedule, closeDay }
    const openDays = days.filter((day) => day.enabled).length
    const totalMinutes = days.reduce((total, day) => total + dayTotalMinutes(day), 0)

    return (
        <main className="dashboard-management working-hours-page">
            <header className="dashboard-management__header">
                <p className="dashboard-eyebrow">Barbearia</p>
                <h1>Horários de atendimento</h1>
                <p>Defina os dias e horários em que você atende. Sua página de agendamento só oferece horários dentro desses períodos.</p>
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
                            <WorkingDayFieldset
                                key={day.day_of_week}
                                day={day}
                                error={validationErrors[day.day_of_week]}
                                actions={dayActions}
                            />
                        ))}
                    </div>

                    <div className="working-hours__footer">
                        <p className="working-hours__footer-hint">Agendamentos existentes são mantidos. Se algum ficar fora dos novos períodos, você poderá revisar antes de confirmar.</p>
                        <button className="dashboard-management__primary working-hours__save" type="submit" disabled={saving}>
                            {saving ? 'Salvando horários...' : 'Salvar horários'}
                        </button>
                    </div>

                    {conflicts && (
                        <ConflictsReview
                            conflicts={conflicts}
                            saving={saving}
                            onReview={() => setConflicts(null)}
                            onConfirm={() => saveSchedule(true)}
                        />
                    )}

                    {saveError && <p className="dashboard-management__message dashboard-management__message--error working-hours__feedback" role="alert">{saveError}</p>}
                    {message && <p className="dashboard-management__message working-hours__feedback" role="status">{message}</p>}
                </form>
            )}
        </main>
    )
}
