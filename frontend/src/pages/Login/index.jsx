import { useState } from 'react'
import { Link } from 'react-router-dom'
import PasswordField from '../../components/PasswordField.jsx'
import { supabase } from '../../lib/supabase.js'
import { getErrorMessage } from '../../utils/errorMessage.js'
import '../../styles/auth.css'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')
        setSubmitting(true)

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
            if (signInError) throw signInError
        } catch (requestError) {
            setError(getErrorMessage(requestError, 'Não foi possível entrar. Tente novamente.'))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <div className="auth-card__brand">
                    <span className="auth-card__mark" aria-hidden="true">N</span>
                    <span className="auth-card__eyebrow">NAVAL</span>
                </div>

                <h1>Bem-vindo de volta</h1>
                <p className="auth-card__subtitle">Entre para gerenciar agendamentos, clientes e o financeiro da sua barbearia.</p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}

                    <div className="auth-field">
                        <label htmlFor="login-email">E-mail</label>
                        <input
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(event) => { setEmail(event.target.value); setError('') }}
                            autoComplete="email"
                            placeholder="voce@email.com"
                            required
                        />
                    </div>

                    <PasswordField
                        id="login-password"
                        label="Senha"
                        value={password}
                        onChange={(event) => { setPassword(event.target.value); setError('') }}
                        autoComplete="current-password"
                        placeholder="Sua senha"
                        required
                    />

                    <button className="auth-submit" type="submit" disabled={submitting}>
                        {submitting ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <div className="auth-links">
                    <span>Ainda não tem conta?</span>
                    <Link to="/register">Criar conta</Link>
                </div>
            </section>
        </main>
    )
}
