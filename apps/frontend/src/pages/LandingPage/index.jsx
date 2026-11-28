import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon.jsx'
import './landing.css'

const FEATURES = [
    { icon: 'calendar', title: 'Agenda online 24h', text: 'Seu cliente escolhe serviço, dia e horário pelo celular. Sem ligação, sem conversa perdida no WhatsApp.' },
    { icon: 'clock', title: 'Sem horário duplicado', text: 'O NAVAL respeita a duração de cada serviço e os seus horários de atendimento.' },
    { icon: 'users', title: 'Clientes organizados', text: 'Cadastro e histórico de atendimentos de cada cliente em um só lugar.' },
    { icon: 'wallet', title: 'Financeiro do dia', text: 'Pagamentos, despesas e estornos com o resumo do que entrou hoje.' },
    { icon: 'box', title: 'Produtos e estoque', text: 'Se você vende pomadas e afins, controle estoque e vendas no mesmo painel.' },
    { icon: 'link', title: 'Seu link próprio', text: 'Uma página com o nome da sua barbearia para divulgar no Instagram e no WhatsApp.' }
]

const STEPS = [
    { title: 'Crie sua conta', text: 'Informe o nome da barbearia e o seu telefone.' },
    { title: 'Cadastre serviços e horários', text: 'Corte, barba, preços, duração e os dias em que você atende.' },
    { title: 'Compartilhe seu link', text: 'Mande no WhatsApp e deixe os clientes agendarem sozinhos.' }
]

const PREVIEW_SLOTS = ['09:00', '09:30', '10:30', '11:00', '14:00', '15:30']

function BookingPreview() {
    return (
        <div className="landing-preview" aria-hidden="true">
            <div className="landing-preview__phone">
                <p className="landing-preview__eyebrow">Agendamento online</p>
                <p className="landing-preview__title">Barbearia do Zé</p>
                <div className="landing-preview__service">
                    <span><strong>Corte degradê</strong><small>40 min</small></span>
                    <span className="landing-preview__price">R$ 35,00</span>
                </div>
                <p className="landing-preview__label">Horários de sábado</p>
                <div className="landing-preview__slots">
                    {PREVIEW_SLOTS.map((slot) => (
                        <span key={slot} className={slot === '10:30' ? 'is-selected' : undefined}>{slot}</span>
                    ))}
                </div>
                <span className="landing-preview__cta">Confirmar agendamento</span>
            </div>
            <div className="landing-preview__toast">
                <Icon name="check" />
                <span><strong>Novo agendamento</strong><small>Sábado, 10:30 · Corte degradê</small></span>
            </div>
        </div>
    )
}

export default function LandingPage() {
    return (
        <div className="landing">
            <header className="landing__nav">
                <span className="landing__brand"><span className="landing__mark" aria-hidden="true">N</span>NAVAL</span>
                <nav aria-label="Acesso">
                    <Link className="landing__nav-link" to="/login">Entrar</Link>
                    <Link className="ui-button ui-button--primary" to="/register">Criar conta</Link>
                </nav>
            </header>

            <main>
                <section className="landing__hero" aria-labelledby="landing-title">
                    <div className="landing__hero-text">
                        <p className="landing__eyebrow">Gestão para barbearias</p>
                        <h1 id="landing-title">Sua cadeira cheia, sua agenda <em>em ordem</em>.</h1>
                        <p className="landing__lead">
                            O NAVAL junta agendamento online, clientes, serviços e financeiro da sua barbearia em um painel simples,
                            feito para usar no celular entre um corte e outro.
                        </p>
                        <div className="landing__actions">
                            <Link className="ui-button ui-button--primary landing__cta" to="/register">Criar minha barbearia<Icon name="arrowRight" /></Link>
                            <Link className="ui-button ui-button--secondary landing__cta" to="/login">Já tenho conta</Link>
                        </div>
                    </div>
                    <BookingPreview />
                </section>

                <section className="landing__section" aria-labelledby="features-title">
                    <p className="landing__eyebrow">Tudo em um lugar</p>
                    <h2 id="features-title">Menos papel, menos mensagem, mais atendimento</h2>
                    <ul className="landing__features">
                        {FEATURES.map((feature) => (
                            <li key={feature.title}>
                                <span className="landing__feature-icon"><Icon name={feature.icon} /></span>
                                <h3>{feature.title}</h3>
                                <p>{feature.text}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="landing__section landing__section--dark" aria-labelledby="steps-title">
                    <p className="landing__eyebrow">Como começar</p>
                    <h2 id="steps-title">Pronto para receber agendamentos em três passos</h2>
                    <ol className="landing__steps">
                        {STEPS.map((step, index) => (
                            <li key={step.title}>
                                <span className="landing__step-number" aria-hidden="true">{index + 1}</span>
                                <h3>{step.title}</h3>
                                <p>{step.text}</p>
                            </li>
                        ))}
                    </ol>
                    <Link className="ui-button ui-button--primary landing__cta" to="/register">Começar agora<Icon name="arrowRight" /></Link>
                </section>
            </main>

            <footer className="landing__footer">
                <span>NAVAL · Gestão para barbearias</span>
                <span>Clientes agendam pela página pública de cada barbearia.</span>
            </footer>
        </div>
    )
}
