import { useEffect, useId, useRef, useState } from 'react'
import { fortalezaToday } from '../utils/dashboard.js'
import './DatePicker.css'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function getToday() {
    return fortalezaToday()
}

function formatDate(value) {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
}

function monthStart(value) {
    return new Date(`${value.slice(0, 7)}-01T00:00:00Z`)
}

function monthValue(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function dateValue(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function shiftDate(value, days) {
    const date = new Date(`${value}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return dateValue(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function isAllowedDate(value, min, max) {
    return (!min || value >= min) && (!max || value <= max)
}

function CalendarIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
}

export default function DatePicker({
    id,
    value,
    onChange,
    min,
    max,
    required = false,
    disabled = false,
    invalid = false,
    describedBy,
    compact = false,
    ariaLabel = 'Selecionar data'
}) {
    const generatedId = useId()
    const triggerId = id || `naval-date-picker-${generatedId}`
    const calendarId = `${triggerId}-calendar`
    const triggerRef = useRef(null)
    const dayRefs = useRef(new Map())
    const today = getToday()
    const initialActiveDate = value || (min && min > today ? min : today)
    const [open, setOpen] = useState(false)
    const [activeDate, setActiveDate] = useState(initialActiveDate)
    const [visibleMonth, setVisibleMonth] = useState(monthStart(initialActiveDate))
    const currentMonth = monthValue(visibleMonth)
    const year = visibleMonth.getUTCFullYear()
    const month = visibleMonth.getUTCMonth()
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
    const monthLabel = new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(visibleMonth)

    useEffect(() => {
        if (!open) return undefined

        function handlePointerDown(event) {
            if (!event.target.closest(`[data-date-picker="${triggerId}"]`)) setOpen(false)
        }

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
                triggerRef.current?.focus()
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open, triggerId])

    useEffect(() => {
        if (open) dayRefs.current.get(activeDate)?.focus()
    }, [open, activeDate, currentMonth])

    function showMonth(amount) {
        const nextMonth = new Date(Date.UTC(year, month + amount, 1))
        const nextMonthValue = monthValue(nextMonth)
        const firstDate = `${nextMonthValue}-01`
        const nextActiveDate = min && firstDate < min ? min : max && firstDate > max ? max : firstDate
        setVisibleMonth(nextMonth)
        setActiveDate(nextActiveDate)
    }

    function focusDate(date) {
        if (!isAllowedDate(date, min, max)) return
        setActiveDate(date)
        setVisibleMonth(monthStart(date))
    }

    function chooseDate(date) {
        onChange(date)
        setOpen(false)
        triggerRef.current?.focus()
    }

    function handleDayKeyDown(event, date) {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            const dateObject = new Date(`${date}T12:00:00Z`)
            const mondayIndex = (dateObject.getUTCDay() + 6) % 7
            const offset = event.key === 'Home' ? -mondayIndex : 6 - mondayIndex
            const nextDate = shiftDate(date, offset)
            focusDate(nextDate)
            return
        }

        if (event.key === 'PageUp' || event.key === 'PageDown') {
            event.preventDefault()
            const amount = event.key === 'PageUp' ? -1 : 1
            const nextMonth = new Date(Date.UTC(year, month + amount, 1))
            const nextDate = dateValue(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 1)
            const boundedDate = min && nextDate < min ? min : max && nextDate > max ? max : nextDate
            focusDate(boundedDate)
            return
        }

        if (offsets[event.key]) {
            event.preventDefault()
            const nextDate = shiftDate(date, offsets[event.key])
            focusDate(nextDate)
        }
    }

    const previousDisabled = Boolean(min && currentMonth <= min.slice(0, 7))
    const nextDisabled = Boolean(max && currentMonth >= max.slice(0, 7))
    const selectedDateLabel = value ? `${ariaLabel}: ${formatDate(value)}` : ariaLabel

    return (
        <div className={`naval-date-picker${compact ? ' naval-date-picker--compact' : ''}${invalid ? ' naval-date-picker--invalid' : ''}`} data-date-picker={triggerId}>
            <button
                ref={triggerRef}
                id={triggerId}
                className="naval-date-picker__trigger"
                type="button"
                aria-label={`${selectedDateLabel}. Abrir calendário`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={calendarId}
                aria-required={required || undefined}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                disabled={disabled}
                onClick={() => {
                    const nextDate = value || (min && min > today ? min : today)
                    setActiveDate(nextDate)
                    setVisibleMonth(monthStart(nextDate))
                    setOpen((wasOpen) => !wasOpen)
                }}
            >
                <span>{value ? formatDate(value) : 'DD/MM/AAAA'}</span>
                <CalendarIcon />
            </button>

            {open && (
                <div className="naval-date-picker__calendar" id={calendarId} role="dialog" aria-label={`Calendário: ${monthLabel}`}>
                    <div className="naval-date-picker__calendar-header">
                        <button type="button" aria-label="Mês anterior" onClick={() => showMonth(-1)} disabled={previousDisabled}>‹</button>
                        <h3 aria-live="polite">{monthLabel}</h3>
                        <button type="button" aria-label="Próximo mês" onClick={() => showMonth(1)} disabled={nextDisabled}>›</button>
                    </div>
                    <div className="naval-date-picker__weekdays" aria-hidden="true">
                        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
                    </div>
                    <div className="naval-date-picker__days">
                        {Array.from({ length: firstWeekday }, (_, index) => <span className="naval-date-picker__blank" key={`blank-${index}`} />)}
                        {Array.from({ length: daysInMonth }, (_, index) => {
                            const day = index + 1
                            const date = dateValue(year, month, day)
                            const outOfRange = !isAllowedDate(date, min, max)
                            return (
                                <button
                                    ref={(element) => {
                                        if (element) dayRefs.current.set(date, element)
                                        else dayRefs.current.delete(date)
                                    }}
                                    key={date}
                                    type="button"
                                    className={`${value === date ? 'naval-date-picker__day--selected' : ''}${today === date ? ' naval-date-picker__day--today' : ''}`}
                                    aria-label={`${day} de ${monthLabel}`}
                                    aria-pressed={value === date}
                                    tabIndex={activeDate === date ? 0 : -1}
                                    disabled={outOfRange}
                                    onClick={() => chooseDate(date)}
                                    onKeyDown={(event) => handleDayKeyDown(event, date)}
                                >
                                    {day}
                                </button>
                            )
                        })}
                    </div>
                    <div className="naval-date-picker__footer">
                        <span>Formato: dia/mês/ano</span>
                        <button type="button" onClick={() => chooseDate(today)} disabled={!isAllowedDate(today, min, max)}>Hoje</button>
                    </div>
                </div>
            )}
        </div>
    )
}
