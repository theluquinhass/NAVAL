import { weekdays, WEEKDAY_INDICES, ALL_DAY_INDICES, dayTotalMinutes, formatDuration } from './scheduleUtils.js'

/**
 * Editor for one weekday: open/closed toggle, its periods and quick copy actions.
 * `actions` carries the page's state updaters (updateDay, updateTime, normalizeTime,
 * addPeriod, removePeriod, copySchedule, closeDay).
 */
export default function WorkingDayFieldset({ day, error, actions }) {
    return (
        <fieldset
            className={`working-hours__day${day.enabled ? ' working-hours__day--open' : ''}`}
            aria-describedby={error ? `working-day-${day.day_of_week}-error` : undefined}
        >
            <legend>{weekdays[day.day_of_week]}</legend>
            <div className="working-hours__day-status">
                <label className="working-hours__toggle" htmlFor={`working-day-${day.day_of_week}`}>
                    <input
                        id={`working-day-${day.day_of_week}`}
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(event) => actions.updateDay(day.day_of_week, { enabled: event.target.checked })}
                    />
                    <span>Atende neste dia</span>
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
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={error ? `working-day-${day.day_of_week}-error` : undefined}
                                    value={period.opens_at}
                                    onChange={(event) => actions.updateTime(day.day_of_week, periodIndex, 'opens_at', event.target.value)}
                                    onBlur={() => actions.normalizeTime(day.day_of_week, periodIndex, 'opens_at')}
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
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={error ? `working-day-${day.day_of_week}-error` : undefined}
                                    value={period.closes_at}
                                    onChange={(event) => actions.updateTime(day.day_of_week, periodIndex, 'closes_at', event.target.value)}
                                    onBlur={() => actions.normalizeTime(day.day_of_week, periodIndex, 'closes_at')}
                                />
                            </label>
                            <button
                                className="working-hours__remove"
                                type="button"
                                onClick={() => actions.removePeriod(day.day_of_week, periodIndex)}
                                aria-label={`Remover período ${periodIndex + 1} de ${weekdays[day.day_of_week]}`}
                            >
                                Remover
                            </button>
                        </div>
                    ))}
                    {error && (
                        <p className="working-hours__day-error" id={`working-day-${day.day_of_week}-error`} role="alert">{error}</p>
                    )}
                    <button className="working-hours__add" type="button" onClick={() => actions.addPeriod(day.day_of_week)}>
                        <span aria-hidden="true">+</span> Adicionar período
                    </button>
                    <div className="working-hours__quick-actions" aria-label={`Ações rápidas para ${weekdays[day.day_of_week]}`}>
                        <button
                            className="working-hours__quick"
                            type="button"
                            onClick={() => actions.copySchedule(day.day_of_week, WEEKDAY_INDICES)}
                            aria-label={`Copiar horário de ${weekdays[day.day_of_week]} para segunda a sexta`}
                        >
                            Copiar para seg–sex
                        </button>
                        <button
                            className="working-hours__quick"
                            type="button"
                            onClick={() => actions.copySchedule(day.day_of_week, ALL_DAY_INDICES)}
                            aria-label={`Copiar horário de ${weekdays[day.day_of_week]} para todos os dias`}
                        >
                            Copiar para todos
                        </button>
                        <button
                            className="working-hours__quick working-hours__quick--close"
                            type="button"
                            onClick={() => actions.closeDay(day.day_of_week)}
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
    )
}
