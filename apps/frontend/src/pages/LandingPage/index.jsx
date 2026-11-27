import { Link } from 'react-router-dom'
import './landing.css'

export default function LandingPage() {
    return (
        <main className="landing-page">
            <div className="landing-page__content">
                <p className="landing-page__eyebrow">NAVAL</p>
                <h1>Gestão inteligente para barbearias.</h1>
                <p className="landing-page__copy">
                    Agendamentos, clientes, serviços e finanças da sua barbearia em um só lugar.
                </p>
                <div className="landing-page__actions">
                    <Link className="landing-page__primary" to="/register">Criar conta</Link>
                    <Link className="landing-page__secondary" to="/login">Entrar</Link>
                </div>
                <p className="landing-page__note">
                    Clientes agendam pela página pública da barbearia cadastrada.
                </p>
            </div>
        </main>
    )
}
