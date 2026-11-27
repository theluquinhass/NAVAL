import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth.js'
import { supabase } from '../../../lib/supabase.js'
import { getErrorMessage } from '../../../utils/dashboard.js'
import Feedback from './SettingsFeedback.jsx'

export default function AccountPanel({ activeTab }) {
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const [feedback, setFeedback] = useState(null)
    const [sending, setSending] = useState(false)
    const [signingOut, setSigningOut] = useState(false)

    async function handleReset() {
        if (!user?.email) return
        setFeedback(null)
        setSending(true)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/login`
            })
            if (error) throw error
            setFeedback({ type: 'success', text: 'Enviamos um link de redefinição para o e-mail da conta.' })
        } catch (error) {
            setFeedback({ type: 'error', text: getErrorMessage(error, 'Não foi possível enviar o link de redefinição.') })
        } finally {
            setSending(false)
        }
    }

    async function handleSignOut() {
        setFeedback(null)
        setSigningOut(true)
        try {
            const { error } = await signOut()
            if (error) throw error
            navigate('/login', { replace: true })
        } catch (error) {
            setFeedback({ type: 'error', text: getErrorMessage(error, 'Não foi possível encerrar a sessão.') })
            setSigningOut(false)
        }
    }

    return (
        <section className="dashboard-management__panel settings__panel" role="tabpanel" id="settings-panel-account" aria-labelledby="settings-tab-account" hidden={activeTab !== 'account'}>
            <div className="dashboard-management__panel-heading">
                <h2>Conta e segurança</h2>
                <p>Gerencie o acesso à sua conta NAVAL.</p>
            </div>

            <Feedback value={feedback} />

            <div className="settings__account-email">
                <span>E-mail da conta</span>
                <strong>{user?.email || 'Não disponível'}</strong>
            </div>

            <div className="dashboard-management__actions">
                <button
                    className="dashboard-management__secondary"
                    type="button"
                    disabled={!user?.email || sending}
                    onClick={handleReset}
                >
                    {sending ? 'Enviando...' : 'Redefinir senha por e-mail'}
                </button>
                <button
                    className="dashboard-management__danger"
                    type="button"
                    disabled={signingOut}
                    onClick={handleSignOut}
                >
                    {signingOut ? 'Saindo...' : 'Sair da conta'}
                </button>
            </div>
        </section>
    )
}
