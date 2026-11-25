import { useState } from 'react'
import { Link } from 'react-router-dom'
import PasswordField from '../../components/PasswordField.jsx'
import { supabase } from '../../lib/supabase.js'
import { getErrorMessage } from '../../utils/errorMessage.js'
import '../../styles/auth.css'

export default function Register() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')
        setMessage('')
        setSubmitting(true)

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name } }
            })
            if (signUpError) throw signUpError
            setMessage('Cadastro realizado! Verifique seu e-mail para confirmar sua conta.')
        } catch (requestError) {
            setError(getErrorMessage(requestError, 'Não foi possível criar a conta. Tente novamente.'))
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

                <h1>Crie sua conta</h1>
                <p className="auth-card__subtitle">Comece a organizar a agenda da sua barbearia em poucos minutos.</p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}
                    {message && <p className="auth-feedback" role="status">{message}</p>}

                    <div className="auth-field">
                        <label htmlFor="register-name">Nome</label>
                        <input
                            id="register-name"
                            type="text"
                            value={name}
                            onChange={(event) => { setName(event.target.value); setError('') }}
                            autoComplete="name"
                            placeholder="Seu nome"
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="register-email">E-mail</label>
                        <input
                            id="register-email"
                            type="email"
                            value={email}
                            onChange={(event) => { setEmail(event.target.value); setError('') }}
                            autoComplete="email"
                            placeholder="voce@email.com"
                            required
                        />
                    </div>

                    <PasswordField
                        id="register-password"
                        label="Senha"
                        value={password}
                        onChange={(event) => { setPassword(event.target.value); setError('') }}
                        autoComplete="new-password"
                        placeholder="Mínimo de 8 caracteres"
                        minLength={8}
                        required
                    />

                    <button className="auth-submit" type="submit" disabled={submitting}>
                        {submitting ? 'Criando conta...' : 'Criar conta'}
                    </button>
                </form>

                <div className="auth-links">
                    <span>Já tem uma conta?</span>
                    <Link to="/login">Entrar</Link>
                </div>
            </section>
        </main>
    )
}
