import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon.jsx'
import { listServices } from '../../services/servicesApi.js'
import { getWorkingHours } from '../../services/schedulingApi.js'

// Guides a new owner through what is needed before clients can book online.
export default function OnboardingChecklist({ linkShared }) {
    const [status, setStatus] = useState({ state: 'loading', hasServices: false, hasHours: false })

    useEffect(() => {
        let active = true
        Promise.all([listServices(), getWorkingHours()])
            .then(([services, hours]) => {
                if (!active) return
                setStatus({ state: 'ready', hasServices: services.length > 0, hasHours: hours.length > 0 })
            })
            .catch(() => {
                if (active) setStatus((current) => ({ ...current, state: 'error' }))
            })
        return () => { active = false }
    }, [])

    if (status.state === 'loading') return null
    if (status.state === 'error') {
        return <p className="onboarding__error" role="status">Não foi possível verificar seus primeiros passos agora.</p>
    }

    const steps = [
        { key: 'profile', done: true, title: 'Criar sua barbearia', text: 'Nome, endereço da página e telefone.' },
        { key: 'services', done: status.hasServices, title: 'Cadastrar seus serviços', text: 'Corte, barba, sobrancelha… com preço e duração.', to: '/dashboard/services', action: 'Cadastrar serviços' },
        { key: 'hours', done: status.hasHours, title: 'Definir seus horários', text: 'Dias e horários em que você atende.', to: '/dashboard/working-hours', action: 'Definir horários' },
        { key: 'share', done: linkShared, title: 'Compartilhar seu link', text: 'Envie o link de agendamento para seus clientes.', href: '#share-link-title', action: 'Ver link' }
    ]
    const completed = steps.filter((step) => step.done).length
    if (completed === steps.length) return null
    const nextStep = steps.find((step) => !step.done)

    return (
        <section className="onboarding" aria-labelledby="onboarding-title">
            <div className="onboarding__heading">
                <div>
                    <p className="onboarding__eyebrow">Primeiros passos</p>
                    <h2 id="onboarding-title">Deixe sua barbearia pronta para receber agendamentos</h2>
                </div>
                <p className="onboarding__count"><strong>{completed}</strong> de {steps.length} concluídos</p>
            </div>
            <div className="onboarding__track" role="progressbar" aria-label="Progresso dos primeiros passos" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={completed}>
                <span style={{ width: `${(completed / steps.length) * 100}%` }} />
            </div>
            <ol className="onboarding__steps">
                {steps.map((step) => {
                    const isNext = step === nextStep
                    const buttonClass = `ui-button ${isNext ? 'ui-button--primary' : 'ui-button--secondary'}`
                    return (
                        <li key={step.key} className={`onboarding__step${step.done ? ' onboarding__step--done' : ''}${isNext ? ' onboarding__step--next' : ''}`}>
                            <span className="onboarding__marker" aria-hidden="true">{step.done && <Icon name="check" />}</span>
                            <div className="onboarding__text">
                                <strong>{step.title}</strong>
                                <span>{step.done ? 'Concluído' : step.text}</span>
                            </div>
                            {!step.done && step.to && <Link className={buttonClass} to={step.to}>{step.action}</Link>}
                            {!step.done && step.href && <a className={buttonClass} href={step.href}>{step.action}</a>}
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
